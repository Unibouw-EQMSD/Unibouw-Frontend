export const environment = {
   production: true,
  apiUrl: 'https://localhost:7143/api',
  getMeEndpoint: '/Me/GetMe',
  redirectUri: 'http://localhost:4200',
  clientId: '2048f36d-c7b0-4871-b4b5-fdccc9c6db49',        // SPA client ID
  tenantId: '2eb919ed-9c4c-4735-a084-8dd266d67044',       // your tenant
  backendClientId: '96b6d570-73e9-4669-98d6-745f22f4acc0', // API client ID
  scopes: ['api://96b6d570-73e9-4669-98d6-745f22f4acc0/Api.Read'], // API scope
  getCategoryType: '/Common/workitemcategorytype',
  getCategoryTypeById: '/WorkItemByCategory',
  getWorkitems: '/WorkItems',
    getWorkitemsByCategory: '/WorkItems/WorkItemByCategory',
  getWorkitemsById: '/WorkItems',
  getSubcontractor: '/Subcontractor',
  getWorkitemsForSubcontractor: '/Common/subcontractorworkitemmapping',
  postSubcontractor: '/Subcontractor'
};