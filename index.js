#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Import the init function
const initProject = require('./init');

// Main function to handle model generation
async function main() {
  const modelName = process.argv[2];
  
  if (modelName === 'init') {
    // Call init project if init command
    await initProject();
  } else {
    // Otherwise call generate crud
    const generateCrud = require('./curd');
    await generateCrud();
  }
}

// Execute main function
main().catch(console.error);

