import { Repository } from './git';

class GitFlow {
  constructor(repository) {
    this.repository = repository;
    this.mainBranch = 'main';
    this.developBranch = 'develop';
    this.featurePrefix = 'feature/';
    this.releasePrefix = 'release/';
    this.hotfixPrefix = 'hotfix/';
  }

  initFlow() {
    this.repository.init();
    this.repository.exec(`checkout -b ${this.mainBranch}`, () => {
      this.repository.exec(`checkout -b ${this.developBranch}`, () => {
        console.log(`GitFlow initialized with ${this.mainBranch} and ${this.developBranch} branches`);
      });
    });
  }

  startFeature(featureName) {
    const branchName = `${this.featurePrefix}${featureName}`;
    this.repository.exec(`checkout -b ${branchName} ${this.developBranch}`, (error) => {
      if (!error) {
        console.log(`Feature branch ${branchName} created from ${this.developBranch}`);
      }
    });
    return branchName;
  }

  finishFeature(featureName) {
    const branchName = featureName.startsWith(this.featurePrefix) 
      ? featureName 
      : `${this.featurePrefix}${featureName}`;
    
    this.repository.exec(`checkout ${this.developBranch}`, () => {
      this.repository.merge(branchName, this.developBranch);
      this.repository.exec(`branch -d ${branchName}`, () => {
        console.log(`Feature ${featureName} merged into ${this.developBranch} and branch deleted`);
      });
    });
  }

  startRelease(version) {
    const branchName = `${this.releasePrefix}${version}`;
    this.repository.exec(`checkout -b ${branchName} ${this.developBranch}`, (error) => {
      if (!error) {
        console.log(`Release branch ${branchName} created from ${this.developBranch}`);
      }
    });
    return branchName;
  }

  finishRelease(version) {
    const branchName = version.startsWith(this.releasePrefix) 
      ? version 
      : `${this.releasePrefix}${version}`;
    
    this.repository.exec(`checkout ${this.mainBranch}`, () => {
      this.repository.merge(branchName, this.mainBranch);
      
      this.repository.tag(version, `Release ${version}`);
      
      this.repository.exec(`checkout ${this.developBranch}`, () => {
        this.repository.merge(branchName, this.developBranch);
        
        this.repository.exec(`branch -d ${branchName}`, () => {
          console.log(`Release ${version} completed and merged into ${this.mainBranch} and ${this.developBranch}`);
        });
      });
    });
  }

  startHotfix(version) {
    const branchName = `${this.hotfixPrefix}${version}`;
    this.repository.exec(`checkout -b ${branchName} ${this.mainBranch}`, (error) => {
      if (!error) {
        console.log(`Hotfix branch ${branchName} created from ${this.mainBranch}`);
      }
    });
    return branchName;
  }

  finishHotfix(version) {
    const branchName = version.startsWith(this.hotfixPrefix) 
      ? version 
      : `${this.hotfixPrefix}${version}`;
    
    this.repository.exec(`checkout ${this.mainBranch}`, () => {
      this.repository.merge(branchName, this.mainBranch);
      
      this.repository.tag(`hotfix-${version}`, `Hotfix ${version}`);
      
      this.repository.exec(`checkout ${this.developBranch}`, () => {
        this.repository.merge(branchName, this.developBranch);
        
        this.repository.exec(`branch -d ${branchName}`, () => {
          console.log(`Hotfix ${version} completed and merged into ${this.mainBranch} and ${this.developBranch}`);
        });
      });
    });
  }
}

export default GitFlow;