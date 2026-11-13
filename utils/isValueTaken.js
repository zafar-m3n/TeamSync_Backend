const db = require("../models");

// Paranoid models (soft-deleted rows excluded by default) still hold their unique
// DB index, so a value belonging to a soft-deleted row must still count as taken.
// Pass excludeId to allow a record to keep its own current value during an update.
const isValueTaken = async (Model, field, value, { excludeId } = {}) => {
  const where = { [field]: value };
  if (excludeId != null) {
    where.id = { [db.Sequelize.Op.ne]: excludeId };
  }

  const existing = await Model.findOne({ where, paranoid: false });
  return Boolean(existing);
};

module.exports = isValueTaken;
