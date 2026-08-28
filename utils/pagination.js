const DEFAULT_LIMIT = parseInt(process.env.NODE_TEAMSYNC_PAGINATION_DEFAULT_LIMIT, 10) || 20;
const MAX_LIMIT = parseInt(process.env.NODE_TEAMSYNC_PAGINATION_MAX_LIMIT, 10) || 100;

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});

module.exports = { parsePagination, buildPaginationMeta };
