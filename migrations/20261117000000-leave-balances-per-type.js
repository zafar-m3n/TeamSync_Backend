"use strict";

// Splits the pooled leave balance (one row per employee and year) into one row per
// employee, leave type and year. The main type keeps the pooled quota; every other
// type with approved usage gets total = used until HR sets a real quota.
const MAIN_TYPE_NAME = "Annual Leave";

const USAGE_SQL = `
  SELECT employee_id, leave_type_id, YEAR(start_date) AS year,
    SUM(IF(is_half_day, 0.5, DATEDIFF(end_date, start_date) + 1)) AS used
  FROM leave_requests
  WHERE status = 'Approved' AND deleted_at IS NULL
  GROUP BY employee_id, leave_type_id, YEAR(start_date)`;

const findMainTypeId = async (sequelize, transaction) => {
  const [rows] = await sequelize.query("SELECT id FROM leave_types WHERE name = ?", {
    replacements: [MAIN_TYPE_NAME],
    transaction,
  });
  return rows.length ? rows[0].id : null;
};

const splitPooledRows = async (sequelize) => {
  await sequelize.transaction(async (transaction) => {
    const [pooled] = await sequelize.query("SELECT * FROM leave_balances", { transaction });
    if (!pooled.length) {
      return;
    }

    let mainTypeId = await findMainTypeId(sequelize, transaction);
    if (!mainTypeId) {
      [mainTypeId] = await sequelize.query("INSERT INTO leave_types (name) VALUES (?)", {
        replacements: [MAIN_TYPE_NAME],
        transaction,
      });
    }

    const [usage] = await sequelize.query(USAGE_SQL, { transaction });

    for (const row of pooled) {
      const perType = usage.filter((u) => u.employee_id === row.employee_id && u.year === row.year);
      const usedFor = (typeId) => parseFloat(perType.find((u) => u.leave_type_id === typeId)?.used ?? 0);

      await sequelize.query("UPDATE leave_balances SET leave_type_id = ?, used_days = ? WHERE id = ?", {
        replacements: [mainTypeId, usedFor(mainTypeId), row.id],
        transaction,
      });

      for (const u of perType.filter((p) => p.leave_type_id !== mainTypeId)) {
        await sequelize.query(
          `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days)
           VALUES (?, ?, ?, ?, ?)`,
          { replacements: [row.employee_id, u.leave_type_id, row.year, u.used, u.used], transaction },
        );
      }

      const recomputed = perType.reduce((sum, u) => sum + parseFloat(u.used), 0);
      if (recomputed !== parseFloat(row.used_days)) {
        console.warn(
          `leave_balances: employee ${row.employee_id}, ${row.year}: pooled used_days ${row.used_days}, approved requests total ${recomputed}`,
        );
      }
    }

    for (const u of usage) {
      if (!pooled.some((p) => p.employee_id === u.employee_id && p.year === u.year)) {
        console.warn(
          `leave_balances: employee ${u.employee_id}, ${u.year}: ${u.used} approved days of type ${u.leave_type_id} but no pooled row`,
        );
      }
    }
  });
};

const foldPerTypeRows = async (sequelize) => {
  await sequelize.transaction(async (transaction) => {
    const mainTypeId = await findMainTypeId(sequelize, transaction);
    const [rows] = await sequelize.query("SELECT * FROM leave_balances ORDER BY id", { transaction });

    const groups = new Map();
    for (const row of rows) {
      const key = `${row.employee_id}:${row.year}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const group of groups.values()) {
      const main = group.find((r) => r.leave_type_id === mainTypeId);
      const keep = main ?? group[0];
      const total = main
        ? parseFloat(main.total_days)
        : group.reduce((sum, r) => sum + parseFloat(r.total_days), 0);
      const used = group.reduce((sum, r) => sum + parseFloat(r.used_days), 0);

      await sequelize.query("UPDATE leave_balances SET total_days = ?, used_days = ? WHERE id = ?", {
        replacements: [total, used, keep.id],
        transaction,
      });
      const others = group.filter((r) => r.id !== keep.id).map((r) => r.id);
      if (others.length) {
        await sequelize.query("DELETE FROM leave_balances WHERE id IN (?)", {
          replacements: [others],
          transaction,
        });
      }
    }
  });
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `ALTER TABLE leave_balances
        ADD COLUMN leave_type_id INT UNSIGNED NULL AFTER employee_id,
        ADD UNIQUE KEY uq_leave_balances_employee_type_year (employee_id, leave_type_id, year)`,
    );
    await sequelize.query("ALTER TABLE leave_balances DROP INDEX uq_leave_balances_employee_year");
    await splitPooledRows(sequelize);
    await sequelize.query(
      `ALTER TABLE leave_balances
        MODIFY leave_type_id INT UNSIGNED NOT NULL,
        ADD CONSTRAINT fk_leave_balances_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
          ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await foldPerTypeRows(sequelize);
    await sequelize.query(
      "ALTER TABLE leave_balances ADD UNIQUE KEY uq_leave_balances_employee_year (employee_id, year)",
    );
    await sequelize.query(
      `ALTER TABLE leave_balances
        DROP FOREIGN KEY fk_leave_balances_type,
        DROP INDEX uq_leave_balances_employee_type_year`,
    );
    await sequelize.query("ALTER TABLE leave_balances DROP INDEX fk_leave_balances_type");
    await sequelize.query("ALTER TABLE leave_balances DROP COLUMN leave_type_id");
  },
};
