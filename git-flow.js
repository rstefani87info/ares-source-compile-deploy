export class GitFlow {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.mainBranch = options.mainBranch ?? "main";
    this.developBranch = options.developBranch ?? "develop";
    this.featurePrefix = options.featurePrefix ?? "feature/";
    this.releasePrefix = options.releasePrefix ?? "release/";
    this.hotfixPrefix = options.hotfixPrefix ?? "hotfix/";
  }

  async initFlow() {
    await this.repository.init();
    await this.repository.checkout("-b", this.mainBranch);
    await this.repository.checkout("-b", this.developBranch);
    return {
      mainBranch: this.mainBranch,
      developBranch: this.developBranch,
    };
  }

  async startFeature(featureName) {
    const branchName = this.normalizeBranchName(featureName, this.featurePrefix);
    await this.repository.git(["checkout", "-b", branchName, this.developBranch]);
    return branchName;
  }

  async finishFeature(featureName) {
    const branchName = this.normalizeBranchName(featureName, this.featurePrefix);
    await this.repository.checkout(this.developBranch);
    await this.repository.merge(branchName);
    await this.repository.git(["branch", "-d", branchName]);
    return branchName;
  }

  async startRelease(version) {
    const branchName = this.normalizeBranchName(version, this.releasePrefix);
    await this.repository.git(["checkout", "-b", branchName, this.developBranch]);
    return branchName;
  }

  async finishRelease(version) {
    const branchName = this.normalizeBranchName(version, this.releasePrefix);
    await this.repository.checkout(this.mainBranch);
    await this.repository.merge(branchName);
    await this.repository.tag(version, `Release ${version}`);
    await this.repository.checkout(this.developBranch);
    await this.repository.merge(branchName);
    await this.repository.git(["branch", "-d", branchName]);
    return branchName;
  }

  async startHotfix(version) {
    const branchName = this.normalizeBranchName(version, this.hotfixPrefix);
    await this.repository.git(["checkout", "-b", branchName, this.mainBranch]);
    return branchName;
  }

  async finishHotfix(version) {
    const branchName = this.normalizeBranchName(version, this.hotfixPrefix);
    await this.repository.checkout(this.mainBranch);
    await this.repository.merge(branchName);
    await this.repository.tag(`hotfix-${version}`, `Hotfix ${version}`);
    await this.repository.checkout(this.developBranch);
    await this.repository.merge(branchName);
    await this.repository.git(["branch", "-d", branchName]);
    return branchName;
  }

  normalizeBranchName(name, prefix) {
    if (!name) throw new Error("Branch name is required");
    return String(name).startsWith(prefix) ? String(name) : `${prefix}${name}`;
  }
}

export default GitFlow;
