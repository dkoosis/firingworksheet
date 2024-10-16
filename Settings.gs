const Settings = (() => {
  return {
    apis: {
      namelyReport: {
        getUrl: function (report_id) {
          return `https://powerhousearts.namely.com/api/v1/reports/${report_id}`;
        }
      },
    },
    sheets: {
      cbi: {
        sheetId: '1TiD0frfEZwm2sPE5AGN7FyuqoKC01RJ9OsF5iPFNHxg',
        sheetName: 'CBI',
        friendlyName: 'CBI Sheet', // Added for consistency
        comment: '' // Added for consistency
      },
      ahd: {
        sheetId: '1ZpFeQ7lZLj9k8XhC-sBquK5PmIt4b0uzRkpO8X-JfPA',
        sheetName: 'AHD',
        friendlyName: 'American Hospital Directory',
        comment: ''
      }
    },
    dictionaries: {
      stateAbbreviation: {
        'Alabama': 'AL',
        'Alaska': 'AK',
        'American Samoa': 'AS',
        'Arizona': 'AZ',
        'Arkansas': 'AR',
        'California': 'CA',
      }
    }
  }
})()
