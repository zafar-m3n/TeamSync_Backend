const { DataTypes } = require("sequelize");

// MariaDB stores JSON as LONGTEXT, so values come back as strings; parse them on read.
const jsonColumn = (name, options = {}) => ({
  type: DataTypes.JSON,
  ...options,
  get() {
    const value = this.getDataValue(name);
    return typeof value === "string" ? JSON.parse(value) : value;
  },
});

module.exports = jsonColumn;
