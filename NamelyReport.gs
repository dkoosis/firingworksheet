const NamelyReport = (() => {

  //  const fetcher = ({hospital_id}) => { 
  // can't get destructured argument to work. not sure why and don't understand the advantage

  const fetcher = (report_id) => {
    const { getUrl } = Settings.apis.namelyReport
    const reportUrl = getUrl(report_id)
    const opt = {
      'contentType': 'application/json',
      'method': 'GET',
      'muteHttpExceptions': true,
      'headers': {
        'Authorization': 'Bearer Zbz9zhnjHjW9Q8equEoBnZ9XdzOSzkPLJeLWo80wA9q59WWyF7oOrgPqlUYvNeTI',
        'Accept': 'application/json'
      }
    };
    Logger.log("reportUrl: " + reportUrl)
    Logger.log(JSON.stringify(opt))
    const result = UrlFetchApp.fetch(reportUrl, opt)
    var r = String(result)
    return r;
  }
  return {
    fetcher
  }
})()
