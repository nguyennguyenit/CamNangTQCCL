import base from '../playwright.config.mjs';
export default { ...base, testDir: '.', webServer: undefined, projects: [{name:'season',use:{baseURL:'http://localhost:4321'}}] };
