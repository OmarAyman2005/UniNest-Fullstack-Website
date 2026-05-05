// server/src/utils/reportPipelines.js

/**
 * Build aggregation pipeline for attendees report.
 * Count registered EventRegister docs per event.
 */
export function buildAttendeesPipeline(eventMatch = {}, regColl = "eventregisters") {
  return [
    { $match: eventMatch },
    {
      $lookup: {
        from: regColl,
        let: { evId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$event", "$$evId"] }, status: "registered" } },
          { $count: "cnt" },
        ],
        as: "regs",
      },
    },
    {
      $addFields: {
        registered: { $ifNull: [{ $arrayElemAt: ["$regs.cnt", 0] }, 0] },
      },
    },
    {
      $project: {
        _id: 0,
        eventId: "$_id",
        name: 1,
        eventType: 1,
        startDateTime: 1,
        endDateTime: 1,
        registered: 1,
      },
    },
    { $sort: { startDateTime: -1 } },
  ];
}

/**
 * Build aggregation pipeline for sales report.
 * revenue = ticketPrice * registeredCount
 */
export function buildSalesPipeline(eventMatch = {}, revenueSort = -1, regColl = "eventregisters") {
  return [
    { $match: eventMatch },
    {
      $lookup: {
        from: regColl,
        let: { evId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$event", "$$evId"] }, status: "registered" } },
          { $count: "cnt" },
        ],
        as: "regs",
      },
    },
    {
      $addFields: {
        registered: { $ifNull: [{ $arrayElemAt: ["$regs.cnt", 0] }, 0] },
        revenue: {
          $cond: [
            { $gt: ["$ticketPrice", null] },
            { $multiply: [{ $ifNull: ["$ticketPrice", 0] }, { $ifNull: [{ $arrayElemAt: ["$regs.cnt", 0] }, 0] }] },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        eventId: "$_id",
        name: 1,
        eventType: 1,
        startDateTime: 1,
        endDateTime: 1,
        revenue: 1,
      },
    },
    { $sort: { revenue: revenueSort, startDateTime: -1, name: 1 } },
  ];
}
