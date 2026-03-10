import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HRcoM API",
      version: "1.0.0",
      description:
        "This is the API documentation for HRcoM, the DotJcoM's HR and Internship Management System!",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "http://localhost:5000",
        description: "Production server",
      },
    ],
    components: {
      schemas: {
        // ================== User Schema ==================
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each user.",
            },
            name: { type: "string", description: "First name of the user." },
            lastName: { type: "string", description: "Last name of the user." },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: { type: "string", description: "Address of the user." },
            joinDate: {
              type: "string",
              format: "date-time",
              description: "Date when the user joined the company.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user in the company.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user (primes).",
            },
            profileImageURL: {
              type: "string",
              description: "URL of the user's profile image (Cloudinary URL).",
            },
            bio: { type: "string", description: "Biography of the user." },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            status: {
              type: "string",
              enum: ["Pending", "Active", "Inactive", "Blocked"],
              description: "The account status of the user.",
            },
            isAvailable: {
              type: "boolean",
              description:
                "Indicates if the user is available to take on more projects.",
            },
            role_id: { type: "string", description: "ID of the user's role." },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Date when the user was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Date when the user was last updated.",
            },
          },
        },

        // ================== User Request Schemas ==================
        CreateUserRequest: {
          type: "object",
          required: [
            "name",
            "lastName",
            "email",
            "address",
            "phoneNumber",
            "position",
            "socialStatus",
            "role_id",
            "department_id",
          ],
          properties: {
            name: {
              type: "string",
              description: "First name of the user.",
            },
            lastName: {
              type: "string",
              description: "Last name of the user.",
            },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: {
              type: "string",
              description: "Address of the user.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user.",
            },
            bio: {
              type: "string",
              description: "Biography of the user.",
            },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            isActive: {
              type: "boolean",
              description: "Indicates if the user is active.",
            },
            isAvailable: {
              type: "boolean",
              description: "Indicates if the user is available.",
            },
            role_id: {
              type: "string",
              description: "ID of the user's role.",
            },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
          },
        },

        UpdateUserRequest: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "First name of the user.",
            },
            lastName: {
              type: "string",
              description: "Last name of the user.",
            },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: {
              type: "string",
              description: "Address of the user.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user.",
            },
            profileImageURL: {
              type: "string",
              description: "URL of the user's profile image.",
            },
            bio: {
              type: "string",
              description: "Biography of the user.",
            },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            isActive: {
              type: "boolean",
              description: "Indicates if the user is active.",
            },
            isAvailable: {
              type: "boolean",
              description: "Indicates if the user is available.",
            },
            role_id: {
              type: "string",
              description: "ID of the user's role.",
            },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
          },
        },

        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            password: {
              type: "string",
              description: "Password of the user.",
            },
          },
        },

        // ================== UserRole Schema ==================
        UserRole: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each user role.",
            },
            name: { type: "string", description: "Name of the role." },
            description: {
              type: "string",
              description: "Description of the role.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the role was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the role was last updated.",
            },
          },
        },

        // ================== User Role Request Schemas ==================
        CreateUserRoleRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Name of the user role." },
            description: {
              type: "string",
              description: "Description of the user role.",
            },
          },
        },

        UpdateUserRoleRequest: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the user role." },
            description: {
              type: "string",
              description: "Description of the user role.",
            },
          },
        },

        // ================== Department Schemas ==================
        Department: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each department.",
            },
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the department was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the department was last updated.",
            },
          },
        },

        // ================== Department Request Schemas ==================
        CreateDepartmentRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
          },
        },

        UpdateDepartmentRequest: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
          },
        },

        // ================== Audit Log Schemas ==================
        AuditLog: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each audit log.",
            },
            admin_id: {
              type: "string",
              description: "ID of the admin who performed the action.",
            },
            action: {
              type: "string",
              description: "The Action performed in the audit log.",
              enum: [
                "CREATE_USER",
                "UPDATE_USER",
                "DELETE_USER",
                "TOGGLE_STATUS",
                "CREATE_DEPARTMENT",
                "UPDATE_DEPARTMENT",
                "DELETE_DEPARTMENT",
                "CREATE_ROLE",
                "UPDATE_ROLE",
                "DELETE_ROLE",
                "UPLOAD_IMAGE",
              ],
            },
            target_type: {
              type: "string",
              description: "The target entity type.",
              enum: ["User", "Department", "UserRole"],
            },
            target_id: {
              type: "string",
              description: "The ID of the target entity.",
            },
            target_name: {
              type: "string",
              description: "The target entity name.",
            },
            details: {
              type: "object",
              description: "The audit log details.",
            },
            ipAddress: {
              type: "string",
              description: "IP address from which the action was performed.",
            },
          },
        },
      },

      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
