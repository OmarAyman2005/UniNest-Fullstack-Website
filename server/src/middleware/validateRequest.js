export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
    }

    // Replace req.body with sanitized/validated values
    req.body = value;
    next();
  };
};