const sendSuccess = (res, statusCode, data, meta = undefined) => {
  const response = { success: true, data };
  if (meta) {
    response.meta = meta;
  }
  return res.status(statusCode).json(response);
};

const sendWithMessage = (res, data, message) => {
  const response = { success: true, data };
  if (message) {
    response.message = message;
  }
  return res.status(200).json(response);
};

// A delete returns the removed resource's id.
const sendDeleted = (res, id, message) => sendWithMessage(res, { id }, message);

// An action with no resource to return.
const sendAction = (res, message) => sendWithMessage(res, null, message);

module.exports = { sendSuccess, sendDeleted, sendAction };
