const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const readline = require('readline');


let isAuthRoute = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function to handle model generation 
module.exports = async function mysqlCurd() {
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

  try {
   

    
    const isAuthRoute = await new Promise((resolve) => {
      if (['user', 'users'].includes(modelName.toLowerCase())) {
        // Default to 'yes' for User or Users without asking
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
          console.log('Running database migration...');
          execSync('npx sequelize-cli db:migrate');
        });
        resolve(true);
      } else {
        // Ask for other models
        rl.question('Do you want middleware route? (yes/no, default: yes): ', (answer) => {
          const response = answer.toLowerCase() || 'yes';
          if (response === 'yes') {
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
              console.log('Running database migration...');
              execSync('npx sequelize-cli db:migrate');
            });
            resolve(true);
          } else if (response === 'no') {
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
              console.log('Running database migration...');
              execSync('npx sequelize-cli db:migrate');
            });
            resolve(false);
          } else {
            console.log('Invalid input. Please type "yes" or "no".');
            rl.close();
            resolve(null);
          }
        });
      }
    });
  
    if (isAuthRoute === null) return;
  } catch (error) {
    console.error('Error generating model:', error.message);
    process.exit(1);
  }

  // Ask if the route should be authenticated

  // Dynamically generate file paths
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
${isAuthRoute ? "const authenticateJWT = require('../middleware/auth');" : ''}

router.post('/', ${isAuthRoute ? 'authenticateJWT, ' : ''}${modelName.toLowerCase()}Controller.create);
router.get('/', ${isAuthRoute ? 'authenticateJWT, ' : ''}${modelName.toLowerCase()}Controller.getAll);
router.get('/:id', ${isAuthRoute ? 'authenticateJWT, ' : ''}${modelName.toLowerCase()}Controller.getById);
router.put('/:id', ${isAuthRoute ? 'authenticateJWT, ' : ''}${modelName.toLowerCase()}Controller.update);
router.delete('/:id', ${isAuthRoute ? 'authenticateJWT, ' : ''}${modelName.toLowerCase()}Controller.delete);

module.exports = router;`;

    // Write Routes to file
    fs.writeFileSync(routeFilePath, routeTemplate);
    console.log(`Routes generated at ${routeFilePath}`);
    rl.close();
  }
  // Write Controller to file
  fs.writeFileSync(controllerFilePath, controllerTemplate);
  console.log(`Controller generated at ${controllerFilePath}`);

  rl.close();
}
