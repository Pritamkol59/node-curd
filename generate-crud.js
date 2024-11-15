const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to initialize project
async function initProject() {
  console.log('Initializing new project...');
  
  // Initialize package.json if not exists
  if (!fs.existsSync('package.json')) {
    execSync('npm init -y');
  }

  // Install base dependencies
  const baseDependencies = [
    'express',
    'body-parser', 
    'dotenv',
    'sequelize',
    'sequelize-cli',
    'fs',
    'path',
    'http',
    'https',
    'jsonwebtoken',
    'bcryptjs' // Added for password hashing
  ];

  console.log('Installing base dependencies...');
  execSync(`npm install ${baseDependencies.join(' ')}`);
  execSync('npm install nodemon --save-dev');

  // Create middleware directory and auth.js
  if (!fs.existsSync('middleware')) {
    fs.mkdirSync('middleware');
  }

  const authMiddlewareContent = `
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = authenticateJWT;
`;

  fs.writeFileSync('middleware/auth.js', authMiddlewareContent);

  // Prompt for database choice
  rl.question('Choose your database (mysql/postgres/sqlite/mongodb): ', async (dbChoice) => {
    let dbDependencies = [];
    let dbConfig = '';
    
    switch(dbChoice.toLowerCase()) {
      case 'mysql':
        dbDependencies = ['mysql2'];
        dbConfig = `
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=your_database
DB_DIALECT=mysql
        `;
        break;
      case 'postgres':
        dbDependencies = ['pg', 'pg-hstore'];
        dbConfig = `
DB_HOST=localhost
DB_USER=postgres
DB_PASS=
DB_NAME=your_database
DB_DIALECT=postgres
        `;
        break;
      case 'sqlite':
        dbDependencies = ['sqlite3'];
        dbConfig = `
DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite
        `;
        break;
      case 'mongodb':
        dbDependencies = ['mongoose'];
        dbConfig = `
MONGODB_URI=mongodb://localhost:27017/your_database
        `;
        break;
    }

    console.log('Installing database dependencies...');
    execSync(`npm install ${dbDependencies.join(' ')}`);

    // Create .env file
    if (!fs.existsSync('.env')) {
      fs.writeFileSync('.env', `
PORT=3000
${dbConfig}
JWT_SECRET=your_jwt_secret_key
      `);
    }

    // Update package.json scripts
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.scripts = {
      ...packageJson.scripts,
      "start": "node index.js",
      "dev": "nodemon index.js",
      "migrate": "sequelize-cli db:migrate",
      "migrate:undo": "sequelize-cli db:migrate:undo",
      "seed": "sequelize-cli db:seed:all"
    };
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

    // Create base index.js if not exists
    if (!fs.existsSync('index.js')) {
      const indexTemplate = `
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const jwt = require('jsonwebtoken');
const authenticateJWT = require('./middleware/auth');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// CORS settings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// API Routes
const apiRouter = express.Router();
app.use('/api/v1', apiRouter);

// Public routes (no authentication required)
apiRouter.use('/users', require('./routes/userRoutes'));

// Protected routes (authentication required)
apiRouter.use('/users/profile', authenticateJWT, require('./routes/userRoutes'));
// Add more protected routes here...

// Test Route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start HTTP server
http.createServer(app).listen(port, () => {
  console.log(\`HTTP Server running on port \${port}\`);
});
      `;
      fs.writeFileSync('index.js', indexTemplate);
    }


//Sequelize initialized
    try {
      console.log('Initializing Sequelize...');
      if (!fs.existsSync('config/config.json')) {
        execSync('npx sequelize-cli init');
        console.log('Sequelize initialized successfully');
      } else {
        console.log('Sequelize already initialized');
      }
    } catch (error) {
      console.error('Error initializing Sequelize:', error.message);
      process.exit(1);
    }

    console.log('Project initialized successfully!\n now genrated model use "node generate-crud.js ModelName Attribute1:Type,Attribute2:Type"\n example:node generate-crud.js User name:string,email:string,password:string');
    rl.close();
  });
}

// Main function to handle model generation 
async function generateCrud() {
  const modelName = process.argv[2];
  const modelAttributes = process.argv[3];

  // Check if this is init command
  if (modelName === 'init') {
    await initProject();
    return;
  }

  // Ensure model name and attributes are provided
  if (!modelName || !modelAttributes) {
    console.log('Please provide a model name and attributes');
    console.log('Examples:');
    console.log('- To initialize project: node generate-crud.js init');
    console.log('- To generate model: node generate-crud.js User name:string,email:string');
    process.exit(1);
  }

  // First run sequelize init
  

  // Generate the model using sequelize-cli
  exec(`npx sequelize-cli model:generate --name ${modelName} --attributes ${modelAttributes}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error generating model: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`Model generated: ${stdout}`);

    // Check if config.json exists and convert to config.js for MySQL
    const configPath = path.join(__dirname, 'config');
    const configJsonPath = path.join(configPath, 'config.json');
    const configJsPath = path.join(configPath, 'config.js');

    if (fs.existsSync(configJsonPath)) {
      const configData = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
      if (configData.development.dialect === 'mysql') {
        const configJsContent = `
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || 'database_development',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || 'database_test',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_PROD || 'database_production',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql'
  }
};`;
        
        // Write the new config.js file
        fs.writeFileSync(configJsPath, configJsContent);
        // Delete the old config.json
        fs.unlinkSync(configJsonPath);
        console.log('Converted config.json to config.js for MySQL environment variables support');
      }
    }

    // Run database migration
    try {
      console.log('Running database migration...');
      execSync('npx sequelize-cli db:migrate');
      
      // Delete and rewrite models/index.js
      const modelsIndexPath = path.join(__dirname, 'models', 'index.js');
      const newModelsIndexContent = `'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.js')[env];

const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;`;

      fs.writeFileSync(modelsIndexPath, newModelsIndexContent);
      console.log('Database migration completed successfully');
      console.log('Updated models/index.js');
    } catch (error) {
      console.error('Error running migration:', error.message);
      process.exit(1);
    }

    // Dynamically generate file paths
    const modelFilePath = path.join(__dirname, 'models', `${modelName.toLowerCase()}.js`);
    const controllerFilePath = path.join(__dirname, 'controllers', `${modelName.toLowerCase()}Controller.js`);
    const routeFilePath = path.join(__dirname, 'routes', `${modelName.toLowerCase()}Routes.js`);

    // Ensure the controllers and routes directories exist
    if (!fs.existsSync(path.join(__dirname, 'controllers'))) fs.mkdirSync(path.join(__dirname, 'controllers'));
    if (!fs.existsSync(path.join(__dirname, 'routes'))) fs.mkdirSync(path.join(__dirname, 'routes'));

    // Create the Controller Template
    let controllerTemplate = `
const { ${modelName} } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
`;

    // Check if model is User/user
    if (modelName.toLowerCase() === 'user') {
      controllerTemplate += `
// Create ${modelName}
exports.create = async (req, res) => {
  try {
    // Hash password if it exists in request body
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }
    
    const ${modelName.toLowerCase()} = await ${modelName}.create(req.body);
    res.status(201).json(${modelName.toLowerCase()});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Login ${modelName}
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ${modelName.toLowerCase()} = await ${modelName}.findOne({ where: { email } });
    
    if (!${modelName.toLowerCase()}) {
      return res.status(404).json({ message: '${modelName} not found' });
    }
    
    // Verify password using bcrypt
    const validPassword = await bcrypt.compare(password, ${modelName.toLowerCase()}.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = jwt.sign(
      { id: ${modelName.toLowerCase()}.id, email: ${modelName.toLowerCase()}.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Remove password from response
    const userWithoutPassword = { ...user.get() };
    delete userWithoutPassword.password;
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const ${modelName.toLowerCase()} = await ${modelName}.findByPk(req.user.id);
    if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
    
    // Hash new password if it's being updated
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }
    
    await ${modelName.toLowerCase()}.update(req.body);
    res.status(200).json(${modelName.toLowerCase()});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};`;

      // Create Routes Template for User
      let routeTemplate = `
const express = require('express');
const router = express.Router();
const ${modelName.toLowerCase()}Controller = require('../controllers/${modelName.toLowerCase()}Controller');
const authenticateJWT = require('../middleware/auth');

// Public routes
router.post('/register', ${modelName.toLowerCase()}Controller.create);
router.post('/login', ${modelName.toLowerCase()}Controller.login);

// Protected routes
router.get('/profile', authenticateJWT, ${modelName.toLowerCase()}Controller.getProfile);
router.put('/profile', authenticateJWT, ${modelName.toLowerCase()}Controller.updateProfile);

module.exports = router;`;

      // Write Routes to file
      fs.writeFileSync(routeFilePath, routeTemplate);
      console.log(`Routes generated at ${routeFilePath}`);

    } else {
      // For non-User models, keep the existing controller and route templates
      controllerTemplate += `
exports.create = async (req, res) => {
  try {
    const ${modelName.toLowerCase()} = await ${modelName}.create(req.body);
    res.status(201).json(${modelName.toLowerCase()});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const ${modelName.toLowerCase()}s = await ${modelName}.findAll();
    res.status(200).json(${modelName.toLowerCase()}s);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const ${modelName.toLowerCase()} = await ${modelName}.findByPk(req.params.id);
    if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
    res.status(200).json(${modelName.toLowerCase()});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const ${modelName.toLowerCase()} = await ${modelName}.findByPk(req.params.id);
    if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
    await ${modelName.toLowerCase()}.update(req.body);
    res.status(200).json(${modelName.toLowerCase()});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const ${modelName.toLowerCase()} = await ${modelName}.findByPk(req.params.id);
    if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
    await ${modelName.toLowerCase()}.destroy();
    res.status(204).json();
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};`;

      // Create standard Routes Template
      let routeTemplate = `
const express = require('express');
const router = express.Router();
const ${modelName.toLowerCase()}Controller = require('../controllers/${modelName.toLowerCase()}Controller');

router.post('/', ${modelName.toLowerCase()}Controller.create);
router.get('/', ${modelName.toLowerCase()}Controller.getAll);
router.get('/:id', ${modelName.toLowerCase()}Controller.getById);
router.put('/:id', ${modelName.toLowerCase()}Controller.update);
router.delete('/:id', ${modelName.toLowerCase()}Controller.delete);

module.exports = router;`;

      // Write Routes to file
      fs.writeFileSync(routeFilePath, routeTemplate);
      console.log(`Routes generated at ${routeFilePath}`);
    }

    // Write Controller to file
    fs.writeFileSync(controllerFilePath, controllerTemplate);
    console.log(`Controller generated at ${controllerFilePath}`);

    rl.close();
  });
}

// Execute main function
generateCrud();
