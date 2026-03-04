import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HRcoM API",
      version: "1.0.0",
      description:
        "This is the API documentation for HRcoM, the DotJcoM HR and Internship Management System!",
    },
    servers: [
      { 
        url: "http://localhost:3000", 
        description: "Development server" 
      },
      { 
        url: "http://localhost:5000", 
        description: "Production server" 
      },
    ],
    components: {
      schemas: {
        // ================== User Schemas ==================
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            joinDate: { type: "string", format: "date-time" },
            phoneNumber: { type: "string" },
            position: { type: "string" },
            bonus: { type: "number" },
            profileImageURL: { type: "string" },
            bio: { type: "string" },
            leaveBalance: { type: "number" },
            socialStatus: { type: "string", enum: ["Married", "Not Married"] },
            hasChildren: { type: "boolean" },
            nbOfChildren: { type: "number" },
            isActive: { type: "boolean" },
            isAvailable: { type: "boolean" },
            role_id: { type: "string" },
            department_id: { type: "string" },
            supervisor_id: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: [
            "name",
            "lastName",
            "email",
            "address",
            "phoneNumber",
            "position",
            "role_id",
            "department_id",
          ],
          properties: {
            name: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            phoneNumber: { type: "string" },
            position: { type: "string" },
            bonus: { type: "number" },
            bio: { type: "string" },
            leaveBalance: { type: "number" },
            socialStatus: { type: "string", enum: ["Married", "Not Married"] },
            hasChildren: { type: "boolean" },
            nbOfChildren: { type: "number" },
            isActive: { type: "boolean" },
            isAvailable: { type: "boolean" },
            role_id: { type: "string" },
            department_id: { type: "string" },
            supervisor_id: { type: "string" },
          },
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            address: { type: "string" },
            phoneNumber: { type: "string" },
            position: { type: "string" },
            bonus: { type: "number" },
            profileImageURL: { type: "string" },
            bio: { type: "string" },
            leaveBalance: { type: "number" },
            socialStatus: { type: "string", enum: ["Married", "Not Married"] },
            hasChildren: { type: "boolean" },
            nbOfChildren: { type: "number" },
            isActive: { type: "boolean" },
            isAvailable: { type: "boolean" },
            role_id: { type: "string" },
            department_id: { type: "string" },
            supervisor_id: { type: "string" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
        },

        // ================== UserRole Schemas ==================
        UserRole: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            code: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserRoleRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },
        UpdateUserRoleRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },

        // ================== Department Schemas ==================
        Department: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateDepartmentRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },
        UpdateDepartmentRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },
      },
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./routes/*.js"], // The route files containing swagger annotations
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
