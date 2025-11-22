module.exports = {
    setIcon: jest.fn(),
    Notice: jest.fn(),
    Plugin: class { },
    PluginSettingTab: class { },
    Setting: class { },
    WorkspaceLeaf: class { },
    ItemView: class { },
    FileView: class { },
    debounce: (fn) => fn,
    normalizePath: (path) => path,
};
