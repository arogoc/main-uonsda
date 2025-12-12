// ============================================================================
// ATTENDANCE CONTROLLER - Complete with Notifications
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createRedisClient } from '../config/redis.js';
import { createNotificationService } from '../notifications/messaging.js';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  CHURCH_TIMEZONE: 'Africa/Nairobi',
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
  longitude: z.number(). min(-180).max(180),
  deviceId: z.string().min(10, 'Invalid device ID'),
});

const createLocationSchema = z.object({
  name: z.string().min(1). max(100),
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
  deactivate: z.boolean().optional(), // NEW: flag to indicate deactivation
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
    const serviceSchedule = Object.entries(SERVICE_SCHEDULES). reduce(
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
  constructor(prisma, redis, notificationService, config = CONFIG) {
    this.prisma = prisma;
    this.redis = redis;
    this.notificationService = notificationService;
    this. config = config;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Get current date/time in church's timezone
   */
  getChurchTime() {
    return new Date(
      new Date().toLocaleString('en-US', {
        timeZone: this.config.CHURCH_TIMEZONE,
      })
    );
  }

  /**
   * Get day boundaries for today in church timezone
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
   */
  async checkDeviceFingerprint(deviceId, email, serviceType) {
    const today = new Date().toISOString().split('T')[0];
    const deviceKey = `attendance:device:${deviceId}:${today}:${serviceType}`;

    const existingEmail = await this.redis.get(deviceKey);

    if (existingEmail && existingEmail !== email) {
      throw new DuplicateDeviceError();
    }

    await this.redis.setex(
      deviceKey,
      this.config. DEVICE_FINGERPRINT_TTL,
      email
    );
  }

  /**
   * Check if this is member's first attendance
   */
  async isFirstAttendance(memberId) {
    const count = await this.prisma.attendance.count({
      where: { memberId },
    });
    return count === 0;
  }

  /**
   * Calculate attendance streak for a member
   */
  async calculateStreak(memberId, serviceType) {
    const attendances = await this.prisma. attendance.findMany({
      where: { memberId, serviceType },
      orderBy: { attendedAt: 'desc' },
      take: 20,
    });

    if (attendances.length === 0) return 0;

    let streak = 1;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < attendances.length - 1; i++) {
      const current = new Date(attendances[i].attendedAt);
      const previous = new Date(attendances[i + 1].attendedAt);
      const diff = current - previous;

      // Check if within 7-14 days (allowing for one week gap)
      if (diff >= oneWeek && diff <= oneWeek * 2) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  // ============================================================================
  // BUSINESS LOGIC METHODS
  // ============================================================================

  /**
   * Mark attendance for a member
   */
  async markAttendance(data) {
    const { email, latitude, longitude, deviceId } = data;

    // Check service time
    const { serviceType, isServiceTime } = this.getCurrentServiceInfo();
    if (! isServiceTime || !serviceType) {
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
    const existingAttendance = await this. prisma.attendance.findFirst({
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

    // Check if first attendance
    const isFirstTime = await this.isFirstAttendance(member.id);

    // Create attendance record
    const attendance = await this.prisma.attendance. create({
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

    // ✅ SEND IMMEDIATE CONFIRMATION EMAIL
    try {
      await this.notificationService.sendAttendanceConfirmation({
        member: attendance.member,
        serviceType: attendance.serviceType,
        attendedAt: attendance.attendedAt,
        locationName: attendance. locationName,
      });
      console.log(`✅ Confirmation email sent to ${attendance.member. email}`);
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
    }

    // ✅ CHECK FOR MILESTONES (Fire and forget - don't wait)
    this.checkAndSendMilestoneNotifications(member, serviceType, isFirstTime). catch(err => {
      console.error('❌ Failed to check milestones:', err);
    });

    return {
      message: `Attendance marked successfully at ${churchLocation.name}! 🙏`,
      data: attendance,
      isFirstTime,
    };
  }

  /**
   * Check and send milestone notifications (async, non-blocking)
   */
  async checkAndSendMilestoneNotifications(member, serviceType, isFirstTime) {
    try {
      // First attendance milestone
      if (isFirstTime) {
        await this.notificationService.sendMilestoneNotification(
          member,
          'FIRST_TIME'
        );
        console.log(`🎉 First-time milestone sent to ${member.email}`);
        return; // Don't check other milestones for first-timers
      }

      // Calculate streak
      const streak = await this.calculateStreak(member.id, serviceType);

      // Check streak milestones
      if (streak === 5) {
        await this.notificationService.sendMilestoneNotification(
          member,
          'STREAK_5',
          { serviceType }
        );
        console.log(`🔥 5-week streak milestone sent to ${member.email}`);
      } else if (streak === 10) {
        await this.notificationService.sendMilestoneNotification(
          member,
          'STREAK_10'
        );
        console.log(`⭐ 10-week streak milestone sent to ${member.email}`);
      }

      // Check monthly perfect attendance
      const now = new Date();
      const startOfMonth = new Date(now. getFullYear(), now.getMonth(), 1);
      const monthlyCount = await this.prisma.attendance.count({
        where: {
          memberId: member.id,
          attendedAt: { gte: startOfMonth },
        },
      });

      // If it's the last week of the month and they have perfect attendance
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (now.getDate() >= daysInMonth - 7 && monthlyCount >= 12) {
        await this.notificationService.sendMilestoneNotification(
          member,
          'MONTHLY_PERFECT',
          { monthlyCount }
        );
        console.log(`👑 Perfect monthly attendance sent to ${member.email}`);
      }

      // Check yearly milestone
      const startOfYear = new Date(now. getFullYear(), 0, 1);
      const yearlyCount = await this.prisma.attendance.count({
        where: {
          memberId: member.id,
          attendedAt: { gte: startOfYear },
        },
      });

      if (yearlyCount === 100) {
        await this.notificationService.sendMilestoneNotification(
          member,
          'YEARLY_100'
        );
        console.log(`🏆 100 attendances milestone sent to ${member.email}`);
      }
    } catch (error) {
      console.error('Error checking milestones:', error);
    }
  }

  /**
   * Get service status and schedule
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
   */
  async getAttendance(filters) {
    const where = {};

    if (filters. startDate || filters.endDate) {
      where.attendedAt = {};
      if (filters.startDate) where.attendedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.attendedAt.lte = new Date(filters.endDate);
    }

    if (filters.serviceType) {
      where.serviceType = filters.serviceType;
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

    if (!member) {
      throw new AttendanceError('Member not found', 404);
    }

    const totalAttendances = member.attendances.length;
    const byService = member.attendances.reduce((acc, att) => {
      acc[att.serviceType] = (acc[att.serviceType] || 0) + 1;
      return acc;
    }, {});

    return {
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      },
      totalAttendances,
      byService,
      recentAttendances: member.attendances,
    };
  }

  /**
   * Get all saved church locations
   */
  async getAllLocations() {
    return await this.prisma.churchLocation.findMany({
      where: { isSaved: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new church location
   */
  async createLocation(data, createdBy) {
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
   */
  async setActiveLocation(locationId, services, deactivate = false) {
  const location = await this.prisma.churchLocation.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    throw new AttendanceError('Location not found', 404);
  }

  return await this.prisma.$transaction(async (tx) => {
    const updateData = {};

    for (const service of services) {
      switch (service) {
        case 'SABBATH_MORNING':
          if (deactivate) {
            // Just deactivate this location's Sabbath
            updateData.isActiveSabbath = false;
          } else {
            // Deactivate all other locations, activate this one
            await tx.churchLocation.updateMany({
              where: { id: { not: locationId } },
              data: { isActiveSabbath: false },
            });
            updateData.isActiveSabbath = true;
          }
          break;
        case 'WEDNESDAY_VESPERS':
          if (deactivate) {
            updateData.isActiveWednesday = false;
          } else {
            await tx.churchLocation.updateMany({
              where: { id: { not: locationId } },
              data: { isActiveWednesday: false },
            });
            updateData.isActiveWednesday = true;
          }
          break;
        case 'FRIDAY_VESPERS':
          if (deactivate) {
            updateData.isActiveFriday = false;
          } else {
            await tx.churchLocation.updateMany({
              where: { id: { not: locationId } },
              data: { isActiveFriday: false },
            });
            updateData.isActiveFriday = true;
          }
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
   */
  async updateLocation(locationId, data) {
    return await this.prisma.churchLocation.update({
      where: { id: locationId },
      data,
    });
  }

  /**
   * Delete a church location
   */
  async deleteLocation(locationId) {
  const location = await this.prisma.churchLocation.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    throw new AttendanceError('Location not found', 404);
  }

  // Auto-deactivate all services before deleting
  await this.prisma.churchLocation.update({
    where: { id: locationId },
    data: {
      isActiveSabbath: false,
      isActiveWednesday: false,
      isActiveFriday: false,
    },
  });

  await this.prisma.churchLocation.delete({
    where: { id: locationId },
  });
}

  /**
   * Get currently active locations for all services
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Unknown error',
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
      const result = await this.service.getServiceStatus();
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
    const { services, deactivate } = setActiveLocationSchema.parse(req.body);
    const result = await this.service.setActiveLocation(id, services, deactivate);
    res.json({
      success: true,
      message: deactivate 
        ? `Services deactivated for ${result.name}`
        : `${result.name} is now active for selected services`,
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
// FACTORY FUNCTION (Dependency Injection)
// ============================================================================

/**
 * Create an attendance controller with all dependencies
 */
export function createAttendanceController(prisma, redis, notificationService) {
  const service = new AttendanceService(prisma, redis, notificationService);
  return new AttendanceController(service);
}

// ============================================================================
// DEFAULT EXPORT (for backward compatibility)
// ============================================================================

const defaultPrisma = new PrismaClient();
const defaultRedis = createRedisClient();
const defaultNotificationService = createNotificationService();

const defaultController = createAttendanceController(
  defaultPrisma,
  defaultRedis,
  defaultNotificationService
);

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

// Export classes for advanced usage
export {
  AttendanceService,
  AttendanceController,
  AttendanceError,
  NotServiceTimeError,
  LocationOutOfBoundsError,
  DuplicateDeviceError,
};