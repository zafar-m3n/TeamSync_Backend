const sendSuccess = (res, statusCode, data, meta = undefined) => {
  const response = { success: true, data };
  if (meta) {
    response.meta = meta;
  }
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess };
