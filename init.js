// Function to initialize project

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to handle database selection
async function selectDatabase() {
  const choices = [
    { number: 1, name: 'MySQL' },
    { number: 2, name: 'PostgreSQL' }, 
    { number: 3, name: 'SQLite' },
    { number: 4, name: 'MongoDB' }
  ];

  let selectedIndex = 0;

  // Function to render menu
  const renderMenu = () => {
    console.clear();
    console.log('\nChoose your database:');
    choices.forEach((choice, index) => {
      if (index === selectedIndex) {
        console.log(`> ${choice.name}`);
      } else {
        console.log(`  ${choice.name}`);
      }
    });
  };

  return new Promise((resolve) => {
    // Handle keypress
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'up' && selectedIndex > 0) {
        selectedIndex--;
        renderMenu();
      } else if (key.name === 'down' && selectedIndex < choices.length - 1) {
        selectedIndex++;
        renderMenu();
      } else if (key.name === 'return') {
        process.stdin.setRawMode(false);
        resolve(choices[selectedIndex].number);
      }
    });

    renderMenu();
  });
}

module.exports = async function initProject() {
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
      'dotenv',
      'readline',
      'mongoose',
      'cors',
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
  
    // Get database choice using arrow key selection
    const choice = await selectDatabase();
    
    let dbDependencies = [];
    let dbConfig = '';
    let dbChoice = '';
    
    switch(choice) {
      case 1:
        dbChoice = 'mysql';
        dbDependencies = ['mysql2'];
        dbConfig = `
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=your_database
DB_DIALECT=mysql
DB_TYPE=mysql
        `;
        break;
      case 2:
        dbChoice = 'postgres';
        dbDependencies = ['pg', 'pg-hstore'];
        dbConfig = `
DB_HOST=localhost
DB_USER=postgres
DB_PASS=
DB_NAME=your_database
DB_DIALECT=postgres
DB_TYPE=postgres
        `;
        break;
      case 3:
        dbChoice = 'sqlite';
        dbDependencies = ['sqlite3'];
        dbConfig = `
DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite
DB_TYPE=sqlite
        `;
        break;
      case 4:
        dbChoice = 'mongodb';
        // dbDependencies = ['mongoose'];
        dbConfig = `
MONGO_URI=mongodb://localhost:27017/your_database
DB_TYPE=mongodb
        `;
        break;
    }

    console.log(`Installing ${dbChoice} dependencies...`);
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
const cors = require('cors');
const authenticateJWT = require('./middleware/auth');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
// apiRouter.use('/users', require('./routes/userRoutes'));

// Protected routes (authentication required)
// apiRouter.use('/users/profile', authenticateJWT, require('./routes/userRoutes'));
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

    
    // Initialize database ORM/ODM based on choice
    if (dbChoice === 'mysql') {
      try {
        console.log('Initializing Sequelize for MySQL...');
        if (!fs.existsSync('config/config.js')) {
          execSync('npx sequelize-cli init');
          console.log('Sequelize initialized successfully for MySQL');
        } else {
          console.log('Sequelize already initialized for MySQL');
        }

        const configJsContent = `
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || 'database_development',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306
  },
  test: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || 'database_test',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306
  },
  production: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_PROD || 'database_production',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306
  }
};`;

        fs.writeFileSync('config/config.js', configJsContent);
        console.log('Config.js for MySQL created successfully');
      } catch (error) {
        console.error('Error initializing Sequelize for MySQL:', error.message);
        process.exit(1);
      }
    } else if (dbChoice === 'postgres') {
      try {
        console.log('Initializing Sequelize for PostgreSQL...');
        if (!fs.existsSync('config/config.js')) {
          execSync('npx sequelize-cli init');
          console.log('Sequelize initialized successfully for PostgreSQL');
        } else {
          console.log('Sequelize already initialized for PostgreSQL');
        }

        const configJsContent = `
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || 'database_development',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432
  },
  test: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_TEST || 'database_test',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432
  },
  production: {
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME_PROD || 'database_production',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432
  }
};`;

        fs.writeFileSync('config/config.js', configJsContent);
        console.log('Config.js for PostgreSQL created successfully');
      } catch (error) {
        console.error('Error initializing Sequelize for PostgreSQL:', error.message);
        process.exit(1);
      }
    } else if (dbChoice === 'sqlite') {
      try {
        console.log('Initializing Sequelize for SQLite...');
        if (!fs.existsSync('config/config.js')) {
          execSync('npx sequelize-cli init');
          console.log('Sequelize initialized successfully for SQLite');
        } else {
          console.log('Sequelize already initialized for SQLite');
        }

        if (!fs.existsSync('./database.sqlite')) {
          fs.writeFileSync('./database.sqlite', '');
          console.log('SQLite database file created successfully');
        }

        const configJsContent = `
require('dotenv').config();

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite'
  },
  test: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite'
  },
  production: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite'
  }
};`;

        fs.writeFileSync('config/config.js', configJsContent);
        console.log('Config.js for SQLite created successfully');
      } catch (error) {
        console.error('Error initializing Sequelize for SQLite:', error.message);
        process.exit(1);
      }


      const configPath = path.join(__dirname, 'config');
      const configJsonPath = path.join(configPath, 'config.json');
      const configJsPath = path.join(configPath, 'config.js');
  

      
    if(dbChoice === 'mysql'||dbChoice === 'postgres'||dbChoice === 'sqlite'){

      try {
        console.log('Setup index...');
        // execSync('npx sequelize-cli db:migrate');
        
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
        // console.log('Database migration completed successfully');
        console.log('Updated models/index.js');
      } catch (error) {
        console.error('Error running :', error.message);
        process.exit(1);
      }
    }

  
     



    } else if (dbChoice === 'mongodb') {
      // Create mongoose connection file
      if (!fs.existsSync('config')) {
        fs.mkdirSync('config');
      }
      
      const mongooseConfig = `
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

connectDB();

module.exports = mongoose;
      `;
      
      fs.writeFileSync('config/database.js', mongooseConfig);
      console.log('MongoDB configuration initialized successfully');
    }



    

    console.log('Project initialized successfully!');
    if (dbChoice === 'mongodb') {
      console.log('\nCongratulation everything going fine. Now You Just Do:');
      console.log('1) Go to .env and configure your DB');
      console.log('2) Generate Automatic API using:');
      console.log('node pritisan.js ModelName field1:type,field2:type');
      console.log('Example: node pritisan.js User name:string,email:string,password:string');
    } else {
      console.log('\nCongratulation everything going fine. Now You Just Do:');
      console.log('1) Go to .env and configure your DB');
      console.log('2) Generate Automatic API using:');
      console.log('node pritisan.js ModelName field1:type,field2:type');
      console.log('Example: node pritisan.js User name:string,email:string,password:string');
    }
    rl.close();
}