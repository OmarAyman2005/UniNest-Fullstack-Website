// controllers/bazaarUpcomingController.js
import { Bazaar } from '../models/Bazaar.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';

export async function getUpcomingBazaars(req, res) {
  try {
    const { pagination, sort } = buildEventQueryOptions(req.query);
    const now = new Date();

    // Upcoming = events that haven't finished yet
    const filter = {
      eventType: 'bazaar',
      endDateTime: { $gte: now },
      ...(req.query.q
        ? {
            $or: [
              { name: { $regex: req.query.q, $options: 'i' } },
              { location: { $regex: req.query.q, $options: 'i' } },
              { description: { $regex: req.query.q, $options: 'i' } },
            ],
          }
        : {}),
    };

    const data = await Bazaar.find(filter)
      .sort(Object.keys(sort || {}).length ? sort : { startDateTime: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Bazaar.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
      totalBazaars: total,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
