const bcrypt = require("bcryptjs");

const saltRounds = () => parseInt(process.env.NODE_TEAMSYNC_BCRYPT_SALT_ROUNDS, 10) || 10;

const hashPassword = (plain) => bcrypt.hash(plain, saltRounds());

const passwordMatches = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, passwordMatches };
