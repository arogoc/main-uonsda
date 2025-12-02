import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Redis from 'ioredis';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  CHURCH_TIMEZONE: 'Africa/Nairobi', // Configure based on church location
  DEFAULT_RADIUS: 100, // meters
  MAX_ATTENDANCE_HISTORY: 50,
  DEVICE_FINGERPRINT_TTL: 86400, // 24 hours in seconds
};

const SERVICE_SCHEDULES = {
  SABBATH_MORNING: {
    day: 6, // Saturday
    startHour: 8,
    endHour: 17,
    name: 'Sabbath Morning',
    displayTime: 'Saturday 8:00 AM - 5:00 PM',
  },
  WEDNESDAY_VESPERS: {
    day: 3, // Wednesday
    startHour: 17,
    endHour: 20,
    name: 'Wednesday Vespers',
    displayTime: 'Wednesday 5:00 PM - 8:00 PM',
  },
  FRIDAY_VESPERS: {
    day: 5, // Friday
    startHour: 17,
    endHour: 20,
    name: 'Friday Vespers',
    displayTime: 'Friday 5:00 PM - 8:00 PM',
  },
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const markAttendanceSchema = z.object({
  email: z.string().email('Invalid email address'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceId: z.string().min(10, 'Invalid device ID'),
});

const createLocationSchema = z. object({
  name: z. string().min(1). max(100),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().int().min(10).max(1000). default(CONFIG.DEFAULT_RADIUS),
  address: z.string().optional(),
});

const setActiveLocationSchema = z.object({
  services: z
    .array(z.enum(['SABBATH_MORNING', 'WEDNESDAY_VESPERS', 'FRIDAY_VESPERS']))
    .min(1),
});

const attendanceQuerySchema = z.object({
  startDate: z.string().datetime(). optional(),
  endDate: z.string().datetime().optional(),
  serviceType: z
    .enum(['SABBATH_MORNING', 'WEDNESDAY_VESPERS', 'FRIDAY_VESPERS'])
    . optional(),
  memberId: z.string().optional(),
});

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

class AttendanceError extends Error {
  constructor(message, statusCode = 400, metadata = {}) {
    super(message);
    this.name = 'AttendanceError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

class NotServiceTimeError extends AttendanceError {
  constructor() {
    const serviceSchedule = Object.entries(SERVICE_SCHEDULES).reduce(
      (acc, [key, val]) => {
        acc[key] = val.displayTime;
        return acc;
      },
      {}
    );

    super('Attendance can only be marked during service times', 403, {
      serviceSchedule,
    });
  }
}

class LocationOutOfBoundsError extends AttendanceError {
  constructor(distance, maxDistance, locationName) {
    super(
      `You must be within ${maxDistance}m of ${locationName} to mark attendance. `,
      403,
      {
        yourDistance: `${Math.round(distance)}m away`,
        requiredDistance: `${maxDistance}m`,
        hint: 'Please make sure you are physically present at the church location.',
      }
    );
  }
}

class DuplicateDeviceError extends AttendanceError {
  constructor() {
    super(
      'This device has already been used to mark attendance for a different member today.',
      429,
      {
        hint: 'Each person must use their own device to mark attendance.  If you need help, please contact church administration.',
      }
    );
  }
}

// ============================================================================
// ATTENDANCE SERVICE CLASS
// ============================================================================

class AttendanceService {
  constructor(prisma, redis, config = CONFIG) {
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lon1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lon2 - Longitude of point 2
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math. cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math. sqrt(1 - a));

    return R * c;
  }

  /**
   * Get current date/time in church's timezone
   * @returns {Date} Current date in church timezone
   */
  getChurchTime() {
    return new Date(
      new Date(). toLocaleString('en-US', {
        timeZone: this.config.CHURCH_TIMEZONE,
      })
    );
  }

  /**
   * Get day boundaries for today in church timezone
   * @returns {{ start: Date, end: Date }}
   */
  getTodayBoundaries() {
    const now = this.getChurchTime();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  /**
   * Determine current service type based on day and time
   * @returns {{ serviceType: string|null, isServiceTime: boolean }}
   */
  getCurrentServiceInfo() {
    const now = this.getChurchTime();
    const day = now.getDay();
    const hour = now.getHours();

    for (const [type, schedule] of Object.entries(SERVICE_SCHEDULES)) {
      if (
        day === schedule.day &&
        hour >= schedule.startHour &&
        hour < schedule.endHour
      ) {
        return { serviceType: type, isServiceTime: true };
      }
    }

    return { serviceType: null, isServiceTime: false };
  }

  /**
   * Get active location for a specific service type
   * @param {string} serviceType - Service type
   * @returns {Promise<Object|null>} Church location
   */
  async getActiveLocationForService(serviceType) {
    const whereClause = {};

    switch (serviceType) {
      case 'SABBATH_MORNING':
        whereClause.isActiveSabbath = true;
        break;
      case 'WEDNESDAY_VESPERS':
        whereClause.isActiveWednesday = true;
        break;
      case 'FRIDAY_VESPERS':
        whereClause.isActiveFriday = true;
        break;
    }

    return await this.prisma.churchLocation.findFirst({ where: whereClause });
  }

  /**
   * Check and set device fingerprint in Redis
   * @param {string} deviceId - Device identifier
   * @param {string} email - Member email
   * @param {string} serviceType - Service type
   * @throws {DuplicateDeviceError} If device already used by different member
   */
  async checkDeviceFingerprint(deviceId, email, serviceType) {
    const today = new Date().toISOString().split('T')[0];
    const deviceKey = `attendance:device:${deviceId}:${today}:${serviceType}`;

    const existingEmail = await this.redis.get(deviceKey);

    if (existingEmail && existingEmail !== email) {
      throw new DuplicateDeviceError();
    }

    // Set with TTL
    await this.redis.setex(
      deviceKey,
      this.config.DEVICE_FINGERPRINT_TTL,
      email
    );
  }

  // ============================================================================
  // BUSINESS LOGIC METHODS
  // ============================================================================

  /**
   * Mark attendance for a member
   * @param {Object} data - Attendance data
   * @param {string} data.email - Member email
   * @param {number} data.latitude - Current latitude
   * @param {number} data.longitude - Current longitude
   * @param {string} data.deviceId - Device identifier
   * @returns {Promise<Object>} Attendance record
   */
  async markAttendance(data) {
    const { email, latitude, longitude, deviceId } = data;

    // Check service time
    const { serviceType, isServiceTime } = this.getCurrentServiceInfo();
    if (!isServiceTime || ! serviceType) {
      throw new NotServiceTimeError();
    }

    // Check device fingerprint
    await this.checkDeviceFingerprint(deviceId, email, serviceType);

    // Find member and location in parallel
    const [member, churchLocation] = await Promise.all([
      this.prisma.member.findUnique({ where: { email } }),
      this.getActiveLocationForService(serviceType),
    ]);

    if (! member) {
      throw new AttendanceError(
        'Member not found with this email.  Please check your email address or register first.',
        404
      );
    }

    if (!churchLocation) {
      throw new AttendanceError(
        'No location has been set for this service. Please contact church administration.',
        500
      );
    }

    // Verify location proximity
    const distance = this.calculateDistance(
      latitude,
      longitude,
      churchLocation.latitude,
      churchLocation.longitude
    );

    if (distance > churchLocation.radius) {
      throw new LocationOutOfBoundsError(
        distance,
        churchLocation.radius,
        churchLocation.name
      );
    }

    // Check for duplicate attendance
    const { start, end } = this.getTodayBoundaries();
    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        serviceType,
        attendedAt: { gte: start, lt: end },
      },
    });

    if (existingAttendance) {
      throw new AttendanceError(
        'You have already marked attendance for this service today!  🎉',
        400,
        {
          attendance: {
            attendedAt: existingAttendance.attendedAt,
            location: existingAttendance.locationName,
          },
        }
      );
    }

    // Create attendance record
    const attendance = await this.prisma.attendance.create({
      data: {
        memberId: member.id,
        serviceType,
        latitude,
        longitude,
        locationName: churchLocation.name,
        isVerified: true,
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      message: `Attendance marked successfully at ${churchLocation.name}!  🙏`,
      data: attendance,
    };
  }

  /**
   * Get service status and schedule
   * @returns {Promise<Object>} Service status information
   */
  async getServiceStatus() {
    const { serviceType, isServiceTime } = this.getCurrentServiceInfo();

    let churchLocation = null;
    if (serviceType) {
      churchLocation = await this.getActiveLocationForService(serviceType);
    }

    const schedule = Object.entries(SERVICE_SCHEDULES).reduce(
      (acc, [key, val]) => {
        const days = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        acc[key] = {
          day: days[val.day],
          time: val.displayTime,
          type: key,
        };
        return acc;
      },
      {}
    );

    return {
      isServiceTime,
      currentService: serviceType,
      churchLocation: churchLocation
        ? {
            name: churchLocation.name,
            description: churchLocation.description,
            latitude: churchLocation.latitude,
            longitude: churchLocation.longitude,
            radius: churchLocation.radius,
            address: churchLocation.address,
          }
        : null,
      schedule,
    };
  }

  /**
   * Get attendance records with filters
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Attendance records and statistics
   */
  async getAttendance(filters) {
    const where = {};

    if (filters. startDate || filters.endDate) {
      where.attendedAt = {};
      if (filters.startDate) where.attendedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.attendedAt.lte = new Date(filters.endDate);
    }

    if (filters.serviceType) {
      where.serviceType = filters. serviceType;
    }

    if (filters.memberId) {
      where.memberId = filters.memberId;
    }

    const [attendances, byService] = await Promise.all([
      this.prisma.attendance. findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              ministry: true,
            },
          },
        },
        orderBy: { attendedAt: 'desc' },
      }),
      this.prisma. attendance.groupBy({
        by: ['serviceType'],
        where,
        _count: true,
      }),
    ]);

    return {
      attendances,
      total: attendances.length,
      byService,
    };
  }

  /**
   * Get member attendance history
   * @param {string} email - Member email
   * @returns {Promise<Object>} Member attendance data
   */
  async getMemberAttendance(email) {
    const member = await this.prisma.member.findUnique({
      where: { email },
      include: {
        attendances: {
          orderBy: { attendedAt: 'desc' },
          take: this.config.MAX_ATTENDANCE_HISTORY,
        },
      },
    });

    if (! member) {
      throw new AttendanceError('Member not found', 404);
    }

    const totalAttendances = member.attendances.length;
    const byService = member.attendances.reduce((acc, att) => {
      acc[att.serviceType] = (acc[att.serviceType] || 0) + 1;
      return acc;
    }, {});

    return {
      member: {
        id: member. id,
        firstName: member. firstName,
        lastName: member. lastName,
        email: member. email,
      },
      totalAttendances,
      byService,
      recentAttendances: member.attendances,
    };
  }

  /**
   * Get all saved church locations
   * @returns {Promise<Array>} List of church locations
   */
  async getAllLocations() {
    return await this.prisma.churchLocation.findMany({
      where: { isSaved: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new church location
   * @param {Object} data - Location data
   * @param {string} createdBy - Admin ID creating the location
   * @returns {Promise<Object>} Created location
   */
  async createLocation(data, createdBy) {
    // Check for duplicate name
    const existing = await this.prisma.churchLocation.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new AttendanceError(
        'A location with this name already exists',
        400
      );
    }

    return await this.prisma.churchLocation.create({
      data: {
        ... data,
        isActiveSabbath: false,
        isActiveWednesday: false,
        isActiveFriday: false,
        isSaved: true,
        createdBy,
      },
    });
  }

  /**
   * Set active location for specific service(s)
   * @param {string} locationId - Location ID
   * @param {Array<string>} services - Array of service types
   * @returns {Promise<Object>} Updated location
   */
  async setActiveLocation(locationId, services) {
    const location = await this.prisma.churchLocation.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      throw new AttendanceError('Location not found', 404);
    }

    // Use transaction to ensure atomicity
    return await this.prisma.$transaction(async (tx) => {
      const updateData = {};

      for (const service of services) {
        switch (service) {
          case 'SABBATH_MORNING':
            await tx.churchLocation.updateMany({
              data: { isActiveSabbath: false },
            });
            updateData.isActiveSabbath = true;
            break;
          case 'WEDNESDAY_VESPERS':
            await tx.churchLocation.updateMany({
              data: { isActiveWednesday: false },
            });
            updateData.isActiveWednesday = true;
            break;
          case 'FRIDAY_VESPERS':
            await tx.churchLocation.updateMany({
              data: { isActiveFriday: false },
            });
            updateData.isActiveFriday = true;
            break;
        }
      }

      return await tx.churchLocation.update({
        where: { id: locationId },
        data: updateData,
      });
    });
  }

  /**
   * Update a church location
   * @param {string} locationId - Location ID
   * @param {Object} data - Updated location data
   * @returns {Promise<Object>} Updated location
   */
  async updateLocation(locationId, data) {
    return await this.prisma.churchLocation.update({
      where: { id: locationId },
      data,
    });
  }

  /**
   * Delete a church location
   * @param {string} locationId - Location ID
   */
  async deleteLocation(locationId) {
    const location = await this.prisma.churchLocation. findUnique({
      where: { id: locationId },
    });

    if (
      location?. isActiveSabbath ||
      location?.isActiveWednesday ||
      location?.isActiveFriday
    ) {
      throw new AttendanceError(
        'Cannot delete a location that is active for any service.  Please deactivate it first.',
        400
      );
    }

    await this.prisma.churchLocation. delete({
      where: { id: locationId },
    });
  }

  /**
   * Get currently active locations for all services
   * @returns {Promise<Object>} Active locations for each service
   */
  async getActiveLocations() {
    const [sabbath, wednesday, friday] = await Promise.all([
      this.prisma.churchLocation.findFirst({
        where: { isActiveSabbath: true },
      }),
      this.prisma. churchLocation.findFirst({
        where: { isActiveWednesday: true },
      }),
      this.prisma.churchLocation. findFirst({
        where: { isActiveFriday: true },
      }),
    ]);

    return { sabbath, wednesday, friday };
  }
}

// ============================================================================
// ATTENDANCE CONTROLLER CLASS
// ============================================================================

class AttendanceController {
  constructor(service) {
    this.service = service;
  }

  /**
   * Handle errors and send appropriate response
   * @param {Error} error - The error object
   * @param {Object} res - Express response object
   */
  handleError(error, res) {
    console.error('Attendance Error:', error);

    if (error instanceof AttendanceError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        ... error.metadata,
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message || 'Unknown error',
    });
  }

  /**
   * Mark attendance for a member
   * @route POST /api/attendance/mark
   * @access Public
   */
  markAttendance = async (req, res) => {
    try {
      const data = markAttendanceSchema.parse(req.body);
      const result = await this.service.markAttendance(data);
      res.status(201).json({ success: true, ... result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get service status and schedule
   * @route GET /api/attendance/status
   * @access Public
   */
  getServiceStatus = async (req, res) => {
    try {
      const result = await this. service.getServiceStatus();
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get attendance records with filters
   * @route GET /api/attendance
   * @access Private (Admin only)
   */
  getAttendance = async (req, res) => {
    try {
      const filters = attendanceQuerySchema.parse(req.query);
      const result = await this. service.getAttendance(filters);
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get member attendance history
   * @route GET /api/attendance/member/:email
   * @access Public
   */
  getMemberAttendance = async (req, res) => {
    try {
      const { email } = req.params;
      const result = await this.service.getMemberAttendance(email);
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get all saved church locations
   * @route GET /api/attendance/locations
   * @access Private (Admin)
   */
  getAllLocations = async (req, res) => {
    try {
      const result = await this.service.getAllLocations();
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Create a new church location
   * @route POST /api/attendance/locations
   * @access Private (CLERK, ELDER)
   */
  createLocation = async (req, res) => {
    try {
      const data = createLocationSchema.parse(req.body);
      const result = await this.service.createLocation(data, req.admin.id);
      res.status(201).json({
        success: true,
        message: 'Church location created successfully',
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Set active location for specific service(s)
   * @route PUT /api/attendance/locations/:id/activate
   * @access Private (CLERK, ELDER)
   */
  setActiveLocation = async (req, res) => {
    try {
      const { id } = req.params;
      const { services } = setActiveLocationSchema.parse(req. body);
      const result = await this.service.setActiveLocation(id, services);
      res.json({
        success: true,
        message: `${result.name} is now active for selected services`,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Update a church location
   * @route PUT /api/attendance/locations/:id
   * @access Private (CLERK, ELDER)
   */
  updateLocation = async (req, res) => {
    try {
      const { id } = req.params;
      const data = createLocationSchema.partial().parse(req.body);
      const result = await this.service.updateLocation(id, data);
      res.json({
        success: true,
        message: 'Location updated successfully',
        data: result,
      });
    } catch (error) {
      this. handleError(error, res);
    }
  };

  /**
   * Delete a church location
   * @route DELETE /api/attendance/locations/:id
   * @access Private (ELDER only)
   */
  deleteLocation = async (req, res) => {
    try {
      const { id } = req.params;
      await this.service.deleteLocation(id);
      res.json({
        success: true,
        message: 'Location deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Get currently active locations for all services
   * @route GET /api/attendance/locations/active
   * @access Private (Admin)
   */
  getActiveLocations = async (req, res) => {
    try {
      const result = await this.service. getActiveLocations();
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}

// ============================================================================
// FACTORY FUNCTION (Dependency Injection Setup)
// ============================================================================

/**
 * Create an attendance controller with all dependencies
 * @param {PrismaClient} prisma - Prisma client instance
 * @param {Redis} redis - Redis client instance
 * @returns {AttendanceController} Controller instance
 */
export function createAttendanceController(prisma, redis) {
  const service = new AttendanceService(prisma, redis);
  return new AttendanceController(service);
}

// ============================================================================
// DEFAULT EXPORT (for backward compatibility)
// ============================================================================

// If you want to use it without dependency injection (not recommended for production)
const defaultPrisma = new PrismaClient();
const defaultRedis = new Redis({
  host: process.env. REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

const defaultController = createAttendanceController(defaultPrisma, defaultRedis);

// Export individual controller methods for direct use in routes
export const markAttendance = defaultController.markAttendance;
export const getServiceStatus = defaultController.getServiceStatus;
export const getAttendance = defaultController.getAttendance;
export const getMemberAttendance = defaultController.getMemberAttendance;
export const getAllLocations = defaultController.getAllLocations;
export const createLocation = defaultController. createLocation;
export const setActiveLocation = defaultController.setActiveLocation;
export const updateLocation = defaultController.updateLocation;
export const deleteLocation = defaultController.deleteLocation;
export const getActiveLocations = defaultController.getActiveLocations;