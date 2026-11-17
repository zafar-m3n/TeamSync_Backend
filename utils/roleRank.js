// Admin > HR > Manager > Employee. Custom roles rank as Employee.
const ROLE_RANK = { Admin: 4, HR: 3, Manager: 2, Employee: 1 };

const rankOf = (role) => (role && !role.isCustom && ROLE_RANK[role.name]) || ROLE_RANK.Employee;

// Admin may act on users of any rank, including other Admins.
const outranksAll = (role) => rankOf(role) === ROLE_RANK.Admin;

const outranks = (role, targetRole) => outranksAll(role) || rankOf(role) > rankOf(targetRole);

module.exports = { rankOf, outranksAll, outranks };
