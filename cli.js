#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { Application, DataSource, DataSourceEntity, DataSourceView } from './application.js';
import BuildManager from './build-manager.js';
import DeployManager from './deploy-manager.js';
import { Repository } from './git.js';
import path from 'path';
import fs from 'fs';

/**
 * aReS AI CLI for SCD module
 * Provides command line interface to manage Source, Compilation and Distribution
 * @module cli
 */

// Display banner
console.log(
  chalk.blue(
    figlet.textSync('aReS AI SCD', { horizontalLayout: 'full' })
  )
);

program
  .version('1.0.0')
  .description('aReS AI CLI for Source, Compilation and Distribution management');

/**
 * Initialize a new application
 */
program
  .command('init <name>')
  .description('Initialize a new application')
  .option('-v, --version <version>', 'Application version', '1.0.0')
  .option('-d, --description <description>', 'Application description')
  .option('-a, --author <author>', 'Application author')
  .option('-u, --url <url>', 'Application URL')
  .option('-b, --base-path <path>', 'Base path', process.cwd())
  .action((name, options) => {
    try {
      const basePath = options.basePath || process.cwd();
      const developmentPath = path.join(basePath, 'src');
      const librariesPath = path.join(basePath, 'lib');
      const buildingPath = path.join(basePath, 'build');
      const documentationPath = path.join(basePath, 'docs');

      const app = new Application(
        name,
        options.version,
        basePath,
        developmentPath,
        librariesPath,
        buildingPath,
        documentationPath,
        options.author || 'aReS AI User',
        options.description || `${name} application`,
        options.url || '',
        null, // git
        null, // flow
        {}, // userSettings
        '' // endPoint
      );

      app.createDirectories();
      
      // Create basic configuration files
      const buildConfig = {
        development: 'npm run build:dev',
        production: 'npm run build:prod',
        outputDir: 'dist',
        testCommand: 'npm test'
      };
      
      fs.writeFileSync(
        path.join(basePath, 'build-config.json'),
        JSON.stringify(buildConfig, null, 2)
      );
      
      console.log(chalk.green(`✓ Application ${name} initialized successfully`));
      console.log(chalk.blue('Directory structure created:'));
      console.log(`  ${basePath}`);
      console.log(`  ├── src/`);
      console.log(`  ├── lib/`);
      console.log(`  ├── build/`);
      console.log(`  └── docs/`);
    } catch (error) {
      console.error(chalk.red(`Error initializing application: ${error.message}`));
    }
  });

/**
 * Build the application
 */
program
  .command('build')
  .description('Build the application')
  .option('-t, --type <type>', 'Build type (development, production)', 'development')
  .option('-c, --config <path>', 'Path to build configuration file', './build-config.json')
  .option('-a, --app <name>', 'Application name (uses current directory if not specified)')
  .action((options) => {
    try {
      // Load application info or create a basic one for the current directory
      const appName = options.app || path.basename(process.cwd());
      const basePath = process.cwd();
      const developmentPath = path.join(basePath, 'src');
      const buildingPath = path.join(basePath, 'build');
      
      const app = new Application(
        appName,
        '1.0.0',
        basePath,
        developmentPath,
        path.join(basePath, 'lib'),
        buildingPath,
        path.join(basePath, 'docs'),
        'aReS AI User',
        `${appName} application`,
        '',
        null,
        null,
        {},
        ''
      );
      
      const buildManager = new BuildManager(app);
      const configPath = path.resolve(options.config);
      
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`Build configuration file not found: ${configPath}`));
        return;
      }
      
      if (!buildManager.loadBuildConfig(configPath)) {
        console.error(chalk.red('Failed to load build configuration'));
        return;
      }
      
      console.log(chalk.blue(`Starting ${options.type} build...`));
      
      buildManager.build(options.type)
        .then(() => buildManager.copyToBuildDirectory())
        .then(() => {
          console.log(chalk.green(`✓ Build completed successfully`));
        })
        .catch((error) => {
          console.error(chalk.red(`Build failed: ${error.message}`));
        });
    } catch (error) {
      console.error(chalk.red(`Error during build: ${error.message}`));
    }
  });

/**
 * Deploy the application
 */
program
  .command('deploy')
  .description('Deploy the application')
  .option('-e, --env <environment>', 'Deployment environment', 'staging')
  .option('-c, --config <path>', 'Path to deployment configuration file', './deploy-config.json')
  .option('-a, --app <name>', 'Application name (uses current directory if not specified)')
  .action((options) => {
    try {
      // Load application info or create a basic one for the current directory
      const appName = options.app || path.basename(process.cwd());
      const basePath = process.cwd();
      const buildingPath = path.join(basePath, 'build');
      
      const app = new Application(
        appName,
        '1.0.0',
        basePath,
        path.join(basePath, 'src'),
        path.join(basePath, 'lib'),
        buildingPath,
        path.join(basePath, 'docs'),
        'aReS AI User',
        `${appName} application`,
        '',
        null,
        null,
        {},
        ''
      );
      
      const deployManager = new DeployManager(app);
      const configPath = path.resolve(options.config);
      
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`Deployment configuration file not found: ${configPath}`));
        return;
      }
      
      if (!deployManager.loadDeployConfig(configPath)) {
        console.error(chalk.red('Failed to load deployment configuration'));
        return;
      }
      
      console.log(chalk.blue(`Starting deployment to ${options.env}...`));
      
      deployManager.deploy(options.env)
        .then(() => {
          console.log(chalk.green(`✓ Deployment completed successfully`));
        })
        .catch((error) => {
          console.error(chalk.red(`Deployment failed: ${error.message}`));
        });
    } catch (error) {
      console.error(chalk.red(`Error during deployment: ${error.message}`));
    }
  });

/**
 * Git repository management
 */
program
  .command('git')
  .description('Git repository management')
  .option('-i, --init', 'Initialize a new Git repository')
  .option('-c, --commit <message>', 'Commit changes')
  .option('-p, --push', 'Push changes to remote')
  .option('-t, --tag <name>', 'Create a new tag', '')
  .option('-m, --message <message>', 'Tag message', '')
  .action((options) => {
    try {
      const repoPath = process.cwd();
      const repoName = path.basename(repoPath);
      
      const repo = new Repository(
        repoName,
        repoPath,
        'aReS AI User',
        `${repoName} repository`,
        '',
        false,
        'MIT',
        '',
        'main',
        'en'
      );
      
      if (options.init) {
        console.log(chalk.blue('Initializing Git repository...'));
        repo.init();
      }
      
      if (options.commit) {
        console.log(chalk.blue(`Committing changes: ${options.commit}`));
        repo.add();
        repo.commit(options.commit);
      }
      
      if (options.push) {
        console.log(chalk.blue('Pushing changes to remote...'));
        repo.push();
      }
      
      if (options.tag && options.message) {
        console.log(chalk.blue(`Creating tag: ${options.tag}`));
        repo.tag(options.tag, options.message);
      }
    } catch (error) {
      console.error(chalk.red(`Git operation failed: ${error.message}`));
    }
  });

/**
 * Run tests
 */
program
  .command('test')
  .description('Run tests')
  .option('-c, --config <path>', 'Path to build configuration file', './build-config.json')
  .action((options) => {
    try {
      const appName = path.basename(process.cwd());
      const basePath = process.cwd();
      
      const app = new Application(
        appName,
        '1.0.0',
        basePath,
        path.join(basePath, 'src'),
        path.join(basePath, 'lib'),
        path.join(basePath, 'build'),
        path.join(basePath, 'docs'),
        'aReS AI User',
        `${appName} application`,
        '',
        null,
        null,
        {},
        ''
      );
      
      const buildManager = new BuildManager(app);
      const configPath = path.resolve(options.config);
      
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`Build configuration file not found: ${configPath}`));
        return;
      }
      
      if (!buildManager.loadBuildConfig(configPath)) {
        console.error(chalk.red('Failed to load build configuration'));
        return;
      }
      
      console.log(chalk.blue('Running tests...'));
      
      buildManager.runTests()
        .then(() => {
          console.log(chalk.green('✓ Tests completed successfully'));
        })
        .catch((error) => {
          console.error(chalk.red(`Tests failed: ${error.message}`));
        });
    } catch (error) {
      console.error(chalk.red(`Error running tests: ${error.message}`));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}