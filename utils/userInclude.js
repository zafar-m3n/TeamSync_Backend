// Include for a User association that only carries the user's employee name.
// Soft-deleted users and employees are kept so a past uploader/assigner still shows.
const withEmployeeName = (association) => ({
  association,
  attributes: ["id"],
  paranoid: false,
  include: { association: "employee", attributes: ["id", "fullName"], paranoid: false },
});

module.exports = { withEmployeeName };
