const fs = require('fs');
const path = require('path');
const mongoCurd = require('./mongoCurd');
const mysqlCURD = require('./mysqlCURD');

// Main function to handle model generation based on DB type
async function generateCRUD() {
  try {
    const envFilePath = path.join(__dirname, '.env');
    const modelsDir = path.join(__dirname, 'models');

    // Create models directory if it doesn't exist
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    // Check if .env exists
    if (!fs.existsSync(envFilePath)) {
      throw new Error('No .env file found. Please run init command first.');
    }

    const envContent = fs.readFileSync(envFilePath, 'utf8');

    // Determine which CRUD generator to use based on the presence of MONGO_URI
    const useMongo = envContent.includes('MONGO_URI');
    const crudGenerator = useMongo ? mongoCurd : mysqlCURD;

    // Execute the appropriate CRUD generator
    await crudGenerator();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export the function
module.exports = generateCRUD;
