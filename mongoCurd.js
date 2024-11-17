const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function to handle model generation 
module.exports = async function mongoCurd() {
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

  // Generate the model using mongoose
  const modelFilePath = path.join(__dirname, 'models', `${modelName.toLowerCase()}.js`);
  const modelTemplate = `
const mongoose = require('../config/database');

const Schema = mongoose.Schema;

const ${modelName}Schema = new Schema({
  ${modelAttributes.split(',').map(attr => {
    const [name, type] = attr.split(':');
    return `${name}: { type: ${type.charAt(0).toUpperCase() + type.slice(1)}, required: true }`;
  }).join(',\n  ')}
});

module.exports = mongoose.model('${modelName}', ${modelName}Schema);
`;

  fs.writeFileSync(modelFilePath, modelTemplate);
  console.log(`Model generated at ${modelFilePath}`);

  // Dynamically generate file paths
  const controllerFilePath = path.join(__dirname, 'controllers', `${modelName.toLowerCase()}Controller.js`);
  const routeFilePath = path.join(__dirname, 'routes', `${modelName.toLowerCase()}Routes.js`);

  // Ensure the controllers and routes directories exist
  if (!fs.existsSync(path.join(__dirname, 'controllers'))) fs.mkdirSync(path.join(__dirname, 'controllers'));
  if (!fs.existsSync(path.join(__dirname, 'routes'))) fs.mkdirSync(path.join(__dirname, 'routes'));

  // Create the Controller Template
  let controllerTemplate = `
  const ${modelName} = require('../models/${modelName}');
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
      
      const ${modelName.toLowerCase()} = new ${modelName}(req.body);
      await ${modelName.toLowerCase()}.save();
      res.status(201).json(${modelName.toLowerCase()});
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  // Login ${modelName}
  exports.login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const ${modelName.toLowerCase()} = await ${modelName}.findOne({ email: email });
      
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
      const user = await ${modelName}.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      // Remove password from response
      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  // Update Profile
  exports.updateProfile = async (req, res) => {
    try {
      const user = await ${modelName}.findById(req.user.id);
      if (!user) return res.status(404).json({ message: '${modelName} not found' });
      
      // Hash new password if it's being updated
      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      }
      
      Object.assign(user, req.body);
      await user.save();
      res.status(200).json(user);
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
  
      }
      
      else {
        // Ask if the route should be authenticated
        const isAuthRoute = await new Promise((resolve) => {
          rl.question('Is this an Auth route? (yes/no): ', (answer) => {
            if (answer.toLowerCase() === 'yes') {
              resolve(true);
            } else if (answer.toLowerCase() === 'no') {
              resolve(false);
            } else {
              console.log('Invalid input. Please type "yes" or "no".');
              rl.close();
              resolve(null);
            }
          });
        });

        if (isAuthRoute === null) return;

        // For non-User models, keep the existing controller and route templates
        controllerTemplate += `
  exports.create = async (req, res) => {
    try {
      const ${modelName.toLowerCase()} = new ${modelName}(req.body);
      const result = await ${modelName.toLowerCase()}.save();
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  exports.getAll = async (req, res) => {
    try {
      const ${modelName.toLowerCase()}s = await ${modelName}.find();
      res.status(200).json(${modelName.toLowerCase()}s);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  exports.getById = async (req, res) => {
    try {
      const ${modelName.toLowerCase()} = await ${modelName}.findById(req.params.id);
      if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
      res.status(200).json(${modelName.toLowerCase()});
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  exports.update = async (req, res) => {
    try {
      const ${modelName.toLowerCase()} = await ${modelName}.findById(req.params.id);
      if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
      const updated = await ${modelName}.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };
  
  exports.delete = async (req, res) => {
    try {
      const ${modelName.toLowerCase()} = await ${modelName}.findById(req.params.id);
      if (!${modelName.toLowerCase()}) return res.status(404).json({ message: '${modelName} not found' });
      await ${modelName}.findByIdAndDelete(req.params.id);
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

