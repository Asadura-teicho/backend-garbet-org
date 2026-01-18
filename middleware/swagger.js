const swaggerAutogen = require('swagger-autogen')();

const outputFile = './swagger-output.json';
const endpointsFiles = ['./server.js'];

const doc = {
  info: {
    title: 'My API',
    description: 'Auto-generated Swagger documentation with JWT auth'
  },
  host: 'localhost:5000',
  schemes: ['http'],
  components: {
    securitySchemes: {
      BearerAuth: {          // <-- JWT Bearer token
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ BearerAuth: [] }] // <-- apply to all routes by default
};

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation generated successfully.');
});
