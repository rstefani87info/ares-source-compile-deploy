
import files from "@ares/files";

/**
 * Base application class for the Ares system
 */
export class Application {
   
    /**
     * Creates a new Application instance
     * @param {string} name - Application name
     * @param {string} version - Application version
     * @param {string} basePath - Base directory path
     * @param {string} developmentPath - Development directory path
     * @param {string} librariesPath - Libraries directory path
     * @param {string} buildingPath - Building directory path
     * @param {string} documentationPath - Documentation directory path
     * @param {string} author - Application author
     * @param {string} description - Application description
     * @param {string} url - Application URL
     * @param {object} git - Git repository information
     * @param {object} flow - Application workflow information
     * @param {object} userSettings - User settings
     * @param {string} endPoint - API endpoint
     */
    constructor(
        name, 
        version,
        basePath,
        developmentPath, 
        librariesPath, 
        buildingPath, 
        documentationPath, 
        author, 
        description, 
        url, 
        git, 
        flow,
        userSettings,
        endPoint
        ) {
        // Validate required parameters
        if (!name) throw new Error("Application name is required");
        if (!version) throw new Error("Application version is required");
        if (!basePath) throw new Error("Base path is required");
        
        this.name = name;
        this.version = version;
        this.basePath = basePath;
        this.developmentPath = developmentPath;
        this.librariesPath = librariesPath;
        this.buildingPath = buildingPath;
        this.documentationPath = documentationPath;
        this.author = author;
        this.description = description;
        this.url = url;
        this.git = git;
        this.flow = flow;
        this.userSettings = userSettings;
        this.endPoint = endPoint;
    }

    /**
     * Creates the application directory structure
     * @returns {boolean} True if directories were created successfully
     */
    createDirectories() {
        try {
            files.createDirectory(this.basePath, true);
            // Fix: Changed developmentDir to developmentPath
            files.createDirectory(this.developmentPath, true);
            files.createDirectory(this.librariesPath, true);
            files.createDirectory(this.buildingPath, true);
            files.createDirectory(this.documentationPath, true);
            return true;
        } catch (error) {
            console.error(`Error creating directories: ${error.message}`);
            return false;
        }
    }

    /**
     * Gets the application ID
     * @returns {string} Application ID
     */
    get id() {
        return this.name.replaceAll(/\W/g, '_').toLowerCase();
    }

    /**
     * Renders Git information as HTML
     * @returns {string} HTML representation of Git information
     */
    showGitAsHTML() {
        if (!this.git) return '<span class="no-git">No Git repository</span>';
        
        return `
            <div class="git-info">
                <span class="git-repo">${this.git.name || 'Unnamed repository'}</span>
                ${this.git.url ? `<a href="${this.git.url}">${this.git.url}</a>` : ''}
            </div>
        `;
    }

    /**
     * Renders workflow information as HTML
     * @returns {string} HTML representation of workflow information
     */
    showFlowAsHTML() {
        if (!this.flow) return '<span class="no-flow">No workflow defined</span>';
        
        return `
            <div class="flow-info">
                <span class="flow-type">${this.flow.type || 'Standard flow'}</span>
                <div class="flow-description">${this.flow.description || ''}</div>
            </div>
        `;
    }

    /**
     * Renders the application as HTML
     * @param {string[]} classes - Additional CSS classes
     * @param {object} i18n - Internationalization object
     * @returns {string} HTML representation of the application
     */
    showAsHTML(classes = [], i18n) {
        return `
        <div class="${this.constructor.name} ${classes.join(' ')}" id="${this.id}">
            <h1>${this.name} ${this.version}</h1>
            <details><summary>${i18n?.t('application.details') || 'details'}</summary>
            <ul>
            <li class="official-url"><label>${i18n?.t('application.official.url') || 'official URL'}</label> ${this.showFlowAsHTML()}<a href="${this.url}">${this.url}</a></li>
            <li class="git-url">${this.showGitAsHTML()}<a href="${this.git}">${this.git}</a></li>
            </ul>
            </details>
            <hr/>
            <p>${this.description}</p>
            ${this.showFlowAsHTML()}
        </div>
        `;
    }
    /**
     * Scans a directory and converts it into an Application instance
     * @param {string} directoryPath - Path to the directory to scan
     * @returns {Application} New Application instance based on directory contents
     * @throws {Error} If directory cannot be read or is invalid
     */
    static scan(directoryPath) {
        if (!files.exists(directoryPath)) {
            throw new Error(`Directory does not exist: ${directoryPath}`);
        }

        // Get base directory name as application name
        const name = files.basename(directoryPath);
        
        // Define standard subdirectories
        const basePath = directoryPath;
        const developmentPath = files.join(directoryPath, 'development');
        const librariesPath = files.join(directoryPath, 'libraries');
        const buildingPath = files.join(directoryPath, 'building');
        const documentationPath = files.join(directoryPath, 'documentation');

        // Try to read package.json if it exists
        let version = '1.0.0';
        let author = '';
        let description = '';
        let url = '';
        let git = null;

        const packageJsonPath = files.join(directoryPath, 'package.json');
        if (files.exists(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(files.readFile(packageJsonPath));
                version = packageJson.version || version;
                author = packageJson.author || author;
                description = packageJson.description || description;
                url = packageJson.homepage || url;
                git = packageJson.repository ? {
                    name: packageJson.name,
                    url: typeof packageJson.repository === 'string' 
                        ? packageJson.repository 
                        : packageJson.repository.url
                } : null;
            } catch (error) {
                console.warn(`Error reading package.json: ${error.message}`);
            }
        }

        return new Application(
            name,
            version,
            basePath,
            developmentPath,
            librariesPath,
            buildingPath,
            documentationPath,
            author,
            description,
            url,
            git,
            null, // flow
            {}, // userSettings
            '' // endPoint
        );
    } 
}

/**
 * DataSource class that extends Application
 * Represents a data source in the Ares system
 */
export class DataSource extends Application {
    /**
     * Creates a new DataSource instance
     * @param {string} name - DataSource name
     * @param {string} developmentDir - Development directory path
     * @param {string} librariesPath - Libraries directory path
     * @param {string} buildingPath - Building directory path
     * @param {string} author - DataSource author
     * @param {string} description - DataSource description
     * @param {string} url - DataSource URL
     * @param {object} git - Git repository information
     * @param {object} flow - DataSource workflow information
     * @param {object} userSettings - User settings
     * @param {string} endPoint - API endpoint
     */
    constructor(
        name, 
        developmentDir, 
        librariesPath, 
        buildingPath, 
        author, 
        description, 
        url, 
        git, 
        flow,
        userSettings,
        endPoint
    ) {
        super(name, developmentDir, librariesPath, buildingPath, author, description, url, git, flow, userSettings, endPoint);
    }
}

/**
 * DataSourceEntity class that extends DataSource
 * Represents an entity within a data source
 */
export class DataSourceEntity extends DataSource {
    /**
     * Creates a new DataSourceEntity instance
     * @param {DataSource} parentDataSource - Parent data source
     * @param {string} name - Entity name
     * @param {string} developmentDir - Development directory path
     * @param {string} librariesPath - Libraries directory path
     * @param {string} buildingPath - Building directory path
     * @param {string} author - Entity author
     * @param {string} description - Entity description
     * @param {string} url - Entity URL
     * @param {object} git - Git repository information
     * @param {object} flow - Entity workflow information
     * @param {object} userSettings - User settings
     * @param {string} endPoint - API endpoint
     * @param {string} indexType - Type of index for this entity
     */
    constructor(
        parentDataSource,
        name, 
        developmentDir, 
        librariesPath, 
        buildingPath, 
        author, 
        description, 
        url, 
        git, 
        flow,
        userSettings,
        endPoint,
        indexType,
    ) {
        super(name, developmentDir, librariesPath, buildingPath, author, description, url, git, flow, userSettings, endPoint);
        this.parentDataSource = parentDataSource;
        this.indexType = indexType;
    }
}

/**
 * DataSourceView class that extends DataSourceEntity
 * Represents a view of an entity within a data source
 */
export class DataSourceView extends DataSourceEntity {
    /**
     * Creates a new DataSourceView instance
     * @param {DataSource} parentDataSource - Parent data source
     * @param {string} name - View name
     * @param {string} developmentDir - Development directory path
     * @param {string} librariesPath - Libraries directory path
     * @param {string} buildingPath - Building directory path
     * @param {string} author - View author
     * @param {string} description - View description
     * @param {string} url - View URL
     * @param {object} git - Git repository information
     * @param {object} flow - View workflow information
     * @param {object} userSettings - User settings
     * @param {string} endPoint - API endpoint
     * @param {string} indexType - Type of index for this view
     */
    constructor(
        parentDataSource,
        name, 
        developmentDir, 
        librariesPath, 
        buildingPath, 
        author, 
        description, 
        url, 
        git, 
        flow,
        userSettings,
        endPoint,
        indexType,
    ) {
        super(parentDataSource, name, developmentDir, librariesPath, buildingPath, author, description, url, git, flow, userSettings, endPoint, indexType);
    }
}
 
 