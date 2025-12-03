// ============================================================================
// ATTENDANCE NOTIFICATION SERVICE
// Handles all messaging after attendance is marked
// ============================================================================

import nodemailer from 'nodemailer';
import { z } from 'zod';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const NOTIFICATION_CONFIG = {
  EMAIL_FROM: process.env. NOTIFICATION_EMAIL || 'info@uonsdamain.org',
  CHURCH_NAME: process.env. CHURCH_NAME || 'UoNSDa Main Church',
  CHURCH_WEBSITE: process.env.CHURCH_WEBSITE || 'https://uonsdamain.org',
  ENABLE_EMAIL: process. env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  ENABLE_SMS: process.env. ENABLE_SMS_NOTIFICATIONS === 'true',
  TIMEZONE: 'Africa/Nairobi',
};

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const MESSAGE_TEMPLATES = {
  // ✅ Success messages (Immediate after marking attendance)
  SUCCESS: {
    SABBATH_MORNING: {
      title: '✅ Sabbath Attendance Confirmed!',
      message: (data) =>
        `Shalom ${data.firstName}! 🙏\n\nYour attendance for Sabbath Morning Service has been successfully recorded at ${data. locationName}.\n\nTime: ${data.attendedAt}\nLocation: ${data.locationName}\n\nMay you be blessed as we worship together!\n\n- ${NOTIFICATION_CONFIG. CHURCH_NAME}`,
      emoji: '🙏',
    },
    WEDNESDAY_VESPERS: {
      title: '✅ Wednesday Vespers Attendance Confirmed!',
      message: (data) =>
        `Hello ${data.firstName}! 🕊️\n\nYour attendance for Wednesday Vespers has been successfully recorded at ${data.locationName}.\n\nTime: ${data.attendedAt}\nLocation: ${data.locationName}\n\nThank you for joining us in midweek worship!\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🕊️',
    },
    FRIDAY_VESPERS: {
      title: '✅ Friday Vespers Attendance Confirmed!',
      message: (data) =>
        `Shabbat Shalom ${data.firstName}! 🕯️\n\nYour attendance for Friday Vespers has been successfully recorded at ${data.locationName}.\n\nTime: ${data.attendedAt}\nLocation: ${data.locationName}\n\nWelcome to the Sabbath!\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🕯️',
    },
  },

  // 🔔 PRE-SERVICE REMINDERS (2 hours before)
  PRE_SERVICE_REMINDERS: {
    SABBATH_MORNING: {
      title: '🔔 Sabbath Service Starting Soon!',
      message: (data) =>
        `Shabbat Shalom ${data.firstName}! 🌅\n\nSabbath Morning Service starts in 2 hours (8:00 AM).\n\nLocation: ${data.locationName}\nAddress: ${data.address}\n\nWe're excited to worship with you today!\n\nDon't forget to mark your attendance when you arrive.  📍\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🌅',
    },
    WEDNESDAY_VESPERS: {
      title: '🔔 Wednesday Vespers Tonight!',
      message: (data) =>
        `Hello ${data.firstName}! 🕊️\n\nWednesday Vespers begins in 2 hours (5:00 PM).\n\nLocation: ${data.locationName}\nAddress: ${data.address}\n\nJoin us for midweek worship and fellowship!\n\nRemember to check in when you arrive. 📍\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🕊️',
    },
    FRIDAY_VESPERS: {
      title: '🔔 Friday Vespers - Welcome the Sabbath!',
      message: (data) =>
        `Shabbat Shalom ${data.firstName}! 🕯️\n\nFriday Vespers starts in 2 hours (5:00 PM).\n\nLocation: ${data.locationName}\nAddress: ${data.address}\n\nCome welcome the Sabbath with us!\n\nDon't forget to mark your attendance.  📍\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🕯️',
    },
  },

  // 🙏 POST-SERVICE THANK YOU (After service ends)
  POST_SERVICE_THANKS: {
    SABBATH_MORNING: {
      title: '🙏 Thank You for Worshiping With Us!',
      message: (data) =>
        `Shalom ${data.firstName}! ✨\n\nThank you for joining us for Sabbath Morning Service today!\n\nYour presence enriched our worship experience.\n\n"I was glad when they said to me, 'Let us go to the house of the Lord! '" - Psalm 122:1\n\nMay you have a blessed rest of the Sabbath!\n\n- ${NOTIFICATION_CONFIG. CHURCH_NAME}`,
      emoji: '✨',
    },
    WEDNESDAY_VESPERS: {
      title: '🙏 Thank You for Joining Vespers!',
      message: (data) =>
        `Hello ${data.firstName}! 💫\n\nThank you for attending Wednesday Vespers!\n\nYour commitment to midweek worship is a blessing.\n\nMay God's peace be with you this week!\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '💫',
    },
    FRIDAY_VESPERS: {
      title: '🙏 Thank You - Shabbat Shalom!',
      message: (data) =>
        `Shabbat Shalom ${data.firstName}! 🌟\n\nThank you for welcoming the Sabbath with us at Friday Vespers!\n\nMay your Sabbath be filled with rest, joy, and God's presence.\n\n"Remember the Sabbath day, to keep it holy." - Exodus 20:8\n\n- ${NOTIFICATION_CONFIG. CHURCH_NAME}`,
      emoji: '🌟',
    },
  },

  // 💭 ABSENCE REMINDERS (Sent to members who haven't attended in a while)
  ABSENCE_REMINDERS: {
    WEEK_1: {
      title: '💭 We Miss You! ',
      message: (data) =>
        `Hello ${data. firstName}, 💙\n\nWe noticed you haven't attended in the past week. We hope everything is okay!\n\nWe'd love to see you at:\n${data.upcomingServices}\n\nIf you need prayer or support, please reach out.\n\nYou're always in our thoughts!\n\n- ${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '💙',
    },
    WEEK_2: {
      title: '🤗 Checking In On You',
      message: (data) =>
        `Dear ${data.firstName},\n\nIt's been 2 weeks since we've seen you at church. We truly miss your presence!\n\nUpcoming Services:\n${data.upcomingServices}\n\nIs there anything we can pray about or help with?  We're here for you.\n\nWith love,\n${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '🤗',
    },
    MONTH_1: {
      title: "❤️ We're Praying for You",
      message: (data) =>
        `Dear ${data.firstName},\n\nIt's been a month since we last worshiped together. We want you to know that you're deeply missed and in our prayers.\n\nNext Services:\n${data.upcomingServices}\n\nIf life has been challenging, please know we're here to support you.  Feel free to reach out anytime.\n\nBlessings,\n${NOTIFICATION_CONFIG.CHURCH_NAME}`,
      emoji: '❤️',
    },
  },

  // Milestones (keep existing ones)
  MILESTONES: {
    FIRST_TIME: {
      title: '🎉 Welcome!  First Attendance',
      message: (data) =>
        `Welcome ${data.firstName}! 🎉\n\nThis is your FIRST recorded attendance at ${NOTIFICATION_CONFIG.CHURCH_NAME}!  We're so blessed to have you worship with us.\n\nMay this be the beginning of a wonderful journey of faith together.\n\nGod bless you!`,
    },
    STREAK_5: {
      title: '🔥 5-Week Streak! ',
      message: (data) =>
        `Amazing ${data.firstName}! 🔥\n\nYou've attended ${data.serviceType} for 5 consecutive weeks! Your dedication is inspiring.\n\nKeep up the faithful attendance! `,
    },
    STREAK_10: {
      title: '⭐ 10-Week Streak!',
      message: (data) =>
        `Incredible ${data.firstName}! ⭐\n\nYou've reached a 10-week attendance streak! Your commitment to worship is truly commendable.\n\nMay God continue to bless your faithfulness!`,
    },
    MONTHLY_PERFECT: {
      title: '👑 Perfect Monthly Attendance!',
      message: (data) =>
        `Hallelujah ${data.firstName}! 👑\n\nYou had PERFECT attendance for all services this month!\n\nTotal attendances: ${data.monthlyCount}\n\nYour dedication is a blessing to our church family! `,
    },
    YEARLY_100: {
      title: '🏆 100 Attendances This Year!',
      message: (data) =>
        `Praise God ${data.firstName}! 🏆\n\nYou've reached 100 attendances this year!  What an incredible milestone!\n\nThank you for being such a faithful member of our church family. `,
    },
  },

  // Admin notifications (keep existing ones)
  ADMIN: {
    ATTENDANCE_SUMMARY: {
      title: '📊 Daily Attendance Summary',
      message: (data) =>
        `Attendance Summary for ${data.date}\n\nService: ${data.serviceType}\nTotal Attendees: ${data.totalCount}\nLocation: ${data.locationName}\n\nTop Ministries:\n${data.topMinistries}\n\nView full report: ${NOTIFICATION_CONFIG.CHURCH_WEBSITE}/admin/attendance`,
    },
    LOW_ATTENDANCE_ALERT: {
      title: '⚠️ Low Attendance Alert',
      message: (data) =>
        `Low attendance detected for ${data.serviceType} on ${data.date}\n\nTotal: ${data.count} (${data.percentageChange}% from average)\n\nPlease review and follow up as needed.`,
    },
  },
};

// ============================================================================
// EMAIL HTML TEMPLATES
// ============================================================================

const EMAIL_HTML_TEMPLATES = {
  SUCCESS: (data, template) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        . header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .emoji { font-size: 64px; margin-bottom: 15px; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .details { background: #f8f9fa; padding: 25px; margin: 25px 0; border-radius: 10px; border-left: 5px solid #667eea; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #555; }
        .detail-value { color: #333; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px; }
        .footer a { color: #667eea; text-decoration: none; }
        .verse { font-style: italic; color: #666; padding: 15px; background: #f0f4ff; border-left: 3px solid #667eea; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">${template.emoji}</div>
          <h1 style="margin: 0; font-size: 28px;">${template.title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${data.firstName} ${data.lastName},</p>
          <div class="details">
            <h3 style="margin-top: 0; color: #667eea;">✅ Attendance Confirmed</h3>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${data.serviceType. replace(/_/g, ' ')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${new Date(data.attendedAt). toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${data.locationName}</span>
            </div>
          </div>
          <p style="font-size: 15px; line-height: 1.8;">${template.message(data). split('\n').join('<br>')}</p>
        </div>
        <div class="footer">
          <p><strong>${NOTIFICATION_CONFIG.CHURCH_NAME}</strong></p>
          <p><a href="${NOTIFICATION_CONFIG. CHURCH_WEBSITE}">${NOTIFICATION_CONFIG.CHURCH_WEBSITE}</a></p>
          <p style="margin-top: 15px; font-size: 12px;">You're receiving this because you marked attendance at our church.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  REMINDER: (data, template) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .emoji { font-size: 64px; margin-bottom: 15px; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .service-info { background: #fff8e1; padding: 25px; margin: 25px 0; border-radius: 10px; border-left: 5px solid #ffc107; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">${template. emoji}</div>
          <h1 style="margin: 0; font-size: 28px;">${template.title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px;">Dear ${data.firstName},</p>
          <div class="service-info">
            <h3 style="margin-top: 0; color: #f57c00;">📍 Service Details</h3>
            <p><strong>Location:</strong> ${data.locationName}</p>
            <p><strong>Address:</strong> ${data.address}</p>
            <p><strong>Time:</strong> Starting in 2 hours</p>
          </div>
          <p style="font-size: 15px; line-height: 1.8;">${template.message(data).split('\n').join('<br>')}</p>
        </div>
        <div class="footer">
          <p><strong>${NOTIFICATION_CONFIG.CHURCH_NAME}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `,

  THANK_YOU: (data, template) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .emoji { font-size: 64px; margin-bottom: 15px; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .verse { font-style: italic; color: #666; padding: 20px; background: #f0f4ff; border-left: 4px solid #667eea; margin: 25px 0; border-radius: 8px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="emoji">${template. emoji}</div>
          <h1 style="margin: 0; font-size: 28px; color: #333;">${template. title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px;">Dear ${data.firstName},</p>
          <p style="font-size: 15px; line-height: 1.8;">${template.message(data).split('\n').join('<br>')}</p>
        </div>
        <div class="footer">
          <p><strong>${NOTIFICATION_CONFIG. CHURCH_NAME}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `,

  MILESTONE: (data, template) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .badge { font-size: 64px; margin: 20px 0; text-align: center; }
        .celebration { background: #fef9e7; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${template.title}</h1>
        </div>
        <div class="content">
          <div class="badge">🎊</div>
          <div class="celebration">
            <h2>Congratulations ${data.firstName}!</h2>
            <p style="font-size: 18px; margin: 20px 0;">${template.message(data).split('\n').join('<br>')}</p>
          </div>
          <p style="text-align: center; color: #666; margin-top: 30px;">
            Keep up the amazing work! Your faithfulness inspires others. 
          </p>
        </div>
        <div class="footer">
          <p>${NOTIFICATION_CONFIG.CHURCH_NAME}</p>
        </div>
      </div>
    </body>
    </html>
  `,
};

// ============================================================================
// NOTIFICATION SERVICE CLASS
// ============================================================================

class NotificationService {
  constructor(emailConfig = {}) {
    this. transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.zoho.com',
      port: process.env.EMAIL_PORT || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER || NOTIFICATION_CONFIG.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    this.initializeScheduledJobs();
  }

  /**
   * Initialize all cron jobs for automated notifications
   */
  initializeScheduledJobs() {
    // ✅ PRE-SERVICE REMINDERS (2 hours before each service)
    
    // Saturday Sabbath reminder at 6:00 AM (2 hours before 8 AM service)
    cron.schedule('0 6 * * 6', () => this.sendPreServiceReminders('SABBATH_MORNING'), {
      timezone: NOTIFICATION_CONFIG.TIMEZONE
    });

    // Wednesday Vespers reminder at 3:00 PM (2 hours before 5 PM)
    cron.schedule('22 12 * * 3', () => this.sendPreServiceReminders('WEDNESDAY_VESPERS'), {
      timezone: NOTIFICATION_CONFIG. TIMEZONE
    });

    // Friday Vespers reminder at 3:00 PM (2 hours before 5 PM)
    cron.schedule('0 15 * * 5', () => this.sendPreServiceReminders('FRIDAY_VESPERS'), {
      timezone: NOTIFICATION_CONFIG.TIMEZONE
    });

    // ✅ POST-SERVICE THANK YOU MESSAGES
    
    // Saturday after Sabbath ends at 5:00 PM
    cron.schedule('0 17 * * 6', () => this. sendPostServiceThanks('SABBATH_MORNING'), {
      timezone: NOTIFICATION_CONFIG.TIMEZONE
    });

    // Wednesday after Vespers at 8:00 PM
    cron.schedule('0 20 * * 3', () => this. sendPostServiceThanks('WEDNESDAY_VESPERS'), {
      timezone: NOTIFICATION_CONFIG. TIMEZONE
    });

    // Friday after Vespers at 8:00 PM
    cron.schedule('0 20 * * 5', () => this. sendPostServiceThanks('FRIDAY_VESPERS'), {
      timezone: NOTIFICATION_CONFIG. TIMEZONE
    });

    // ✅ ABSENCE REMINDERS (Weekly check on Mondays at 10 AM)
    cron.schedule('0 10 * * 1', () => this.sendAbsenceReminders(), {
      timezone: NOTIFICATION_CONFIG.TIMEZONE
    });

    console.log('✅ All notification cron jobs initialized');
  }

  /**
   * Send pre-service reminders to all active members
   * @param {string} serviceType - Type of service
   */
  async sendPreServiceReminders(serviceType) {
    try {
      console.log(`📧 Sending pre-service reminders for ${serviceType}...`);

      const activeMembers = await prisma.member.findMany({
        where: { membershipStatus: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, email: true }
      });

      const location = await this.getActiveLocation(serviceType);
      if (!location) {
        console. log('⚠️ No active location found for service');
        return;
      }

      const template = MESSAGE_TEMPLATES.PRE_SERVICE_REMINDERS[serviceType];
      const data = {
        locationName: location.name,
        address: location.address || 'University of Nairobi'
      };

      for (const member of activeMembers) {
        const memberData = { ...data, firstName: member.firstName, lastName: member.lastName };
        
        await this.sendEmail({
          to: member.email,
          subject: template.title,
          text: template.message(memberData),
          html: EMAIL_HTML_TEMPLATES. REMINDER(memberData, template),
        });
      }

      console.log(`✅ Sent ${activeMembers.length} pre-service reminders`);
    } catch (error) {
      console.error('Error sending pre-service reminders:', error);
    }
  }

  /**
   * Send thank you messages to members who attended
   * @param {string} serviceType - Type of service
   */
  async sendPostServiceThanks(serviceType) {
    try {
      console.log(`📧 Sending post-service thank you for ${serviceType}...`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysAttendances = await prisma.attendance.findMany({
        where: {
          serviceType,
          attendedAt: { gte: today, lt: tomorrow }
        },
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      });

      const template = MESSAGE_TEMPLATES.POST_SERVICE_THANKS[serviceType];

      for (const attendance of todaysAttendances) {
        const data = {
          firstName: attendance. member.firstName,
          lastName: attendance.member.lastName,
        };

        await this.sendEmail({
          to: attendance.member.email,
          subject: template.title,
          text: template.message(data),
          html: EMAIL_HTML_TEMPLATES. THANK_YOU(data, template),
        });
      }

      console.log(`✅ Sent ${todaysAttendances.length} thank you messages`);
    } catch (error) {
      console. error('Error sending post-service thanks:', error);
    }
  }

  /**
   * Send reminders to members who haven't attended in a while
   */
  async sendAbsenceReminders() {
    try {
      console.log('📧 Checking for absent members...');

      const oneWeekAgo = new Date();
      oneWeekAgo. setDate(oneWeekAgo.getDate() - 7);

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo. getDate() - 30);

      const activeMembers = await prisma.member.findMany({
        where: { membershipStatus: 'ACTIVE' },
        include: {
          attendances: {
            orderBy: { attendedAt: 'desc' },
            take: 1
          }
        }
      });

      const upcomingServices = `
📍 Sabbath Morning - Saturday 8:00 AM
📍 Wednesday Vespers - Wednesday 5:00 PM
📍 Friday Vespers - Friday 5:00 PM
      `. trim();

      for (const member of activeMembers) {
        const lastAttendance = member.attendances[0]?.attendedAt;
        
        if (! lastAttendance || lastAttendance < oneMonthAgo) {
          await this.sendAbsenceReminder(member, 'MONTH_1', upcomingServices);
        } else if (lastAttendance < twoWeeksAgo) {
          await this.sendAbsenceReminder(member, 'WEEK_2', upcomingServices);
        } else if (lastAttendance < oneWeekAgo) {
          await this.sendAbsenceReminder(member, 'WEEK_1', upcomingServices);
        }
      }

      console.log('✅ Absence reminders sent');
    } catch (error) {
      console. error('Error sending absence reminders:', error);
    }
  }

  /**
   * Send absence reminder to a specific member
   * @param {Object} member - Member object
   * @param {string} reminderType - Type of reminder (WEEK_1, WEEK_2, MONTH_1)
   * @param {string} upcomingServices - Formatted list of upcoming services
   */
  async sendAbsenceReminder(member, reminderType, upcomingServices) {
    const template = MESSAGE_TEMPLATES. ABSENCE_REMINDERS[reminderType];
    const data = {
      firstName: member.firstName,
      upcomingServices
    };

    await this.sendEmail({
      to: member. email,
      subject: template. title,
      text: template. message(data),
      html: EMAIL_HTML_TEMPLATES. REMINDER(data, template),
    });
  }

  /**
   * Get active location for a service type
   * @param {string} serviceType - Service type
   * @returns {Promise<Object|null>} Church location
   */
  async getActiveLocation(serviceType) {
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

    return await prisma.churchLocation.findFirst({ where: whereClause });
  }

  /**
   * ✅ Send attendance confirmation notification (IMMEDIATE)
   * @param {Object} attendanceData - Attendance record with member info
   * @returns {Promise<Object>} Notification result
   */
  async sendAttendanceConfirmation(attendanceData) {
    const { member, serviceType, attendedAt, locationName } = attendanceData;
    
    const template = MESSAGE_TEMPLATES.SUCCESS[serviceType];
    if (!template) {
      throw new Error(`No template found for service type: ${serviceType}`);
    }

    const data = {
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      serviceType,
      attendedAt,
      locationName,
    };

    const notifications = [];

    // Send email if enabled
    if (NOTIFICATION_CONFIG. ENABLE_EMAIL) {
      const emailResult = await this.sendEmail({
        to: member.email,
        subject: template.title,
        text: template.message(data),
        html: EMAIL_HTML_TEMPLATES.SUCCESS(data, template),
      });
      notifications.push({ type: 'email', ...emailResult });
    }

    return {
      success: true,
      message: template.message(data),
      notifications,
    };
  }

  /**
   * Send milestone achievement notification
   * @param {Object} memberData - Member info
   * @param {string} milestoneType - Type of milestone achieved
   * @param {Object} additionalData - Extra data for the message
   * @returns {Promise<Object>} Notification result
   */
  async sendMilestoneNotification(memberData, milestoneType, additionalData = {}) {
    const template = MESSAGE_TEMPLATES.MILESTONES[milestoneType];
    if (!template) {
      throw new Error(`No template found for milestone: ${milestoneType}`);
    }

    const data = { ...memberData, ...additionalData };

    if (NOTIFICATION_CONFIG.ENABLE_EMAIL) {
      return await this.sendEmail({
        to: memberData.email,
        subject: template.title,
        text: template.message(data),
        html: EMAIL_HTML_TEMPLATES.MILESTONE(data, template),
      });
    }

    return { success: true, message: template. message(data) };
  }

  /**
   * Send email using nodemailer
   * @param {Object} mailOptions - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(mailOptions) {
    try {
      const info = await this.transporter.sendMail({
        from: `${NOTIFICATION_CONFIG. CHURCH_NAME} <${NOTIFICATION_CONFIG.EMAIL_FROM}>`,
        ... mailOptions,
      });

      return {
        success: true,
        messageId: info.messageId,
        sentAt: new Date(),
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get message template for display (without sending)
   * @param {string} serviceType - Type of service
   * @param {Object} data - Data for template
   * @returns {string} Formatted message
   */
  getConfirmationMessage(serviceType, data) {
    const template = MESSAGE_TEMPLATES.SUCCESS[serviceType];
    return template ? template.message(data) : 'Attendance marked successfully! ';
  }

  /**
   * Send admin summary notification
   * @param {Object} summaryData - Daily summary data
   * @returns {Promise<Object>} Notification result
   */
  async sendAdminSummary(summaryData) {
    const template = MESSAGE_TEMPLATES. ADMIN. ATTENDANCE_SUMMARY;
    const adminEmail = process.env.ADMIN_EMAIL || NOTIFICATION_CONFIG.EMAIL_FROM;

    return await this.sendEmail({
      to: adminEmail,
      subject: template.title,
      text: template.message(summaryData),
    });
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

export function createNotificationService(config = {}) {
  return new NotificationService(config);
}

export default NotificationService;
export { MESSAGE_TEMPLATES, NOTIFICATION_CONFIG };