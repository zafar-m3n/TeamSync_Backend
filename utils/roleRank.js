// Admin > HR > Manager > Employee. Custom roles rank as Employee.
const ROLE_RANK = { Admin: 4, HR: 3, Manager: 2, Employee: 1 };

const rankOf = (role) => (role && !role.isCustom && ROLE_RANK[role.name]) || ROLE_RANK.Employee;

module.exports = { ROLE_RANK, rankOf };
