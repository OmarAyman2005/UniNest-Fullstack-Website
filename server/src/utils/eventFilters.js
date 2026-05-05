export function buildEventQueryOptions(query) {
  const filter = {};

  // 🔍 Filter by name (case-insensitive)
  if (query.name) {
    filter.name = { $regex: query.name, $options: 'i' };
  }

  // 🎭 Filter by event type
  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  // 📍 Filter by location (case-insensitive)
  if (query.location) {
    filter.location = { $regex: query.location, $options: 'i' };
  }

  // 🗓 Filter by date range
  if (query.startDateTime || query.endDateTime) {
    filter.startDateTime = {};
    if (query.startDateTime) {
      filter.startDateTime.$gte = new Date(query.startDateTime);
    }
    if (query.endDateTime) {
      filter.startDateTime.$lte = new Date(query.endDateTime);
    }
  }

  // 📄 Pagination
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(query.limit, 10) || 10, 1);
  const skip = (page - 1) * limit;

  // ↕️ Sorting
  const sortBy = query.sortBy || 'startDateTime';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  return { filter, pagination: { skip, limit, page }, sort };
}