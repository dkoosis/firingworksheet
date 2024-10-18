let employeeData = new Map();
let departments = new Map();

/**
 * Loads employee data from the Namely report and pre-calculates necessary attributes.
 */
function loadData() {
  Logger.log(arguments.callee.name); // DEBUG

  try {
    PropertiesService.getScriptProperties().setProperty('lastRefresh', new Date().toString());

    const jsonString = NamelyReport.fetcher(NAMELY_REPORT_ID);
    const jsonData = JSON.parse(jsonString);

    const report = jsonData.reports[0];
    const columns = report.columns;
    const employeeRawData = report.content;

    for (const row of employeeRawData) {
      let employee = {};
      for (let i = 0; i < columns.length; i++) {
        const columnName = columns[i].name;
        employee[columnName] = row[i];
      }

      const startDate = new Date(employee.profiles_start_date);
      const endDate = employee.profiles_departure_date ? new Date(employee.profiles_departure_date) : new Date();
      const diffInMs = endDate.getTime() - startDate.getTime();
      const diffInMonths = Math.floor(diffInMs / (MS_PER_DAY * DAYS_PER_MONTH));
      const diffInYears = Math.floor(diffInMs / (MS_PER_DAY * DAYS_PER_YEAR));

      employee.tenureInMonths = diffInMonths;
      employee.tenureInYears = diffInYears;

      employeeData.set(employee.profiles_guid, employee);
    }

    for (const employee of employeeData.values()) {
      employee.reportsToCount = calculateReportsTo(employee.profiles_guid);
    }

    function calculateReportsTo(employeeId) {
      const employee = employeeData.get(employeeId);
      if (!employee) {
        return 0;
      }
      const employeeEmail = employee.profiles_email;
      let count = 0;
      for (const emp of employeeData.values()) {
        if (emp.profiles_reports_to_email === employeeEmail) {
          count++;
        }
      }
      return count;
    }

    for (const employee of employeeData.values()) {
      const departmentId = employee.profiles_category_200009617;
      if (!departments.has(departmentId)) {
        departments.set(departmentId, {
          id: departmentId,
          name: employee.profiles_category_200009617,
          departmentHeadcount: 0,
          totalTenureInMonths: 0
        });
      }
      const department = departments.get(departmentId);
      department.departmentHeadcount++;
      department.totalTenureInMonths += employee.tenureInMonths;
    }

    for (const department of departments.values()) {
      department.averageTenureInMonths = Math.round(department.totalTenureInMonths / department.departmentHeadcount);
    }

    // Calculate total headcount
    let totalHeadcount = 0;
    for (const department of departments.values()) {
      totalHeadcount += department.departmentHeadcount;
    }
    departments.set('all', {
      departmentHeadcount: totalHeadcount,
      name: 'All Departments'
    });

    Logger.log("departments: " + departments.size);
    Logger.log("Employee data loaded successfully!");
    return true; // Indicate success

  } catch (error) {
    // Log the full error object for debugging
    Logger.log("Error in loadData: " + error); 

    // Return a plain JavaScript object with the error message and a status code
    return { 
      error: "Failed to load employee data: " + error.message, 
      status: 500 
    };
  }
}
/**
 * Retrieves employee data by employeeId and optionally includes direct reports.
 */
function getEmployee(e) {
  const employeeId = e.parameter.employeeId;
  const includeDirectReports = e.parameter.includeDirectReports || 'false'; // Default to 'false'
  const employee = employeeData.get(employeeId);

  // Improved error handling
  if (!employee) {
    Logger.log(`Error in getEmployee: Employee not found with ID ${employeeId}`);
    return {
      error: `Employee not found with ID: ${employeeId}`,
      employeeId: employeeId,
      status: 404 // Include a status code for the error
    };
  }

  let response = { employee: {} };
  response.employee = {
    id: employee.profiles_guid,
    firstName: employee.profiles_first_name,
    lastName: employee.profiles_last_name,
    email: employee.profiles_email,
    jobTitle: employee.profiles_job_title,
    userStatus: employee.profiles_user_status,
    department: {
      id: employee.profiles_category_200009617,
      name: employee.profiles_category_200009617
    },
    employeeType: employee.profiles_employee_type,
    reportsToEmail: employee.profiles_reports_to_email,
    startDate: employee.profiles_start_date,
    division: employee.profiles_category_200009618,
    officeLocation: employee.profiles_office_address1,
    tenureInMonths: employee.tenureInMonths,
    tenureInYears: employee.tenureInYears,
    reportsToCount: employee.reportsToCount
  };

  if (includeDirectReports === 'true') {
    response.employee.directReports = getDirectReports(employee.profiles_email);
  }

  return response; // Return the employee data
}
/**
 * Retrieves direct reports for a given manager's email.
 */
function getDirectReports(managerEmail) {
  // Logger.log(arguments.callee.name); // DEBUG
  const directReports = Array.from(employeeData.values()).filter(employee => {
    return employee.profiles_reports_to_email === managerEmail && !employee.profiles_departure_date; // Filter out past employees
  });

  return directReports.map(report => ({
    id: report.profiles_guid,
    firstName: report.profiles_first_name,
    lastName: report.profiles_last_name,
    // ... (map other relevant properties) ...
  }));
}

/**
 * Retrieves a list of employees based on query parameters.
 */
function getEmployees(e) {
  Logger.log(arguments.callee.name); // DEBUG
  const { firstName, lastName, emailPrefix, departmentId, recentHire } = e.parameter;
  const includePastEmployees = e.parameter.includePastEmployees || 'false'; // Default to 'false' if not provided

  const matchingEmployees = Array.from(employeeData.values()).filter(employee => {
    if (firstName && !employee.profiles_first_name.toLowerCase().includes(firstName.toLowerCase())) {
      return false;
    }
    if (lastName && !employee.profiles_last_name.toLowerCase().includes(lastName.toLowerCase())) {
      return false;
    }
    if (emailPrefix && !employee.profiles_email.toLowerCase().startsWith(emailPrefix.toLowerCase())) {
      return false;
    }
    if (departmentId && employee.profiles_category_200009617 !== departmentId) {
      return false;
    }
    if (recentHire === 'true') {
      const startDate = new Date(employee.profiles_start_date);
      const now = new Date();
      const timeDiff = now.getTime() - startDate.getTime();
      const diffInDays = Math.floor(timeDiff / MS_PER_DAY);
      if (diffInDays > 7) {
        return false;
      }
    }
    if (includePastEmployees !== 'true' && employee.profiles_departure_date) {  // Check for past employees
      return false; // Exclude if includePastEmployees is not true
    }
    return true;
  });

  employees = matchingEmployees.map(employee => ({
    id: employee.profiles_guid,
    firstName: employee.profiles_first_name,
    lastName: employee.profiles_last_name,
    email: employee.profiles_email,
    jobTitle: employee.profiles_job_title,
    userStatus: employee.profiles_user_status,
    department: {
      id: employee.profiles_category_200009617,
      name: employee.profiles_category_200009617
    },
    employeeType: employee.profiles_employee_type,
    reportsToEmail: employee.profiles_reports_to_email,
    startDate: employee.profiles_start_date,
    division: employee.profiles_category_200009618,
    officeLocation: employee.profiles_office_address1,
    tenureInMonths: employee.tenureInMonths,
    tenureInYears: employee.tenureInYears,
    reportsToCount: employee.reportsToCount
  }));
  return { employees: employees }; // Return a plain JavaScript object
}
/**
 * Retrieves department data by departmentId.
 */
function getDepartment(e) {
  Logger.log(arguments.callee.name); // DEBUG
  const departmentId = e.parameter.departmentId;
  const includePastEmployees = e.parameter.includePastEmployees || 'false'; // Default to 'false' if not provided

  // Calculate departmentHeadcount, considering includePastEmployees
  let departmentHeadcount = 0;
  let totalTenureInMonths = 0; // Initialize totalTenureInMonths
  for (const employee of employeeData.values()) {
    if (employee.profiles_category_200009617 === departmentId) {
      if (includePastEmployees === 'true' || !employee.profiles_departure_date) {
        departmentHeadcount++;
        totalTenureInMonths += employee.tenureInMonths; // Add tenure if employee is included in the count
      }
    }
  }

  let response = {};
  response.department = {
    id: departmentId,
    name: departmentId, // You might need to map this to the actual department name
    departmentHeadcount: departmentHeadcount, // Use the calculated headcount
    averageTenureInMonths: Math.round(totalTenureInMonths / departmentHeadcount) // Calculate average tenure
  };

  return response;
}
/**
 * Retrieves a list of all departments.
 */
function getDepartments(e) {
  Logger.log(arguments.callee.name); // DEBUG
  const includePastEmployees = e.parameter.includePastEmployees === 'true'; // Improve comparison

  // Calculate department statistics, considering includePastEmployees
  const departmentData = Array.from(departments.values());
  const departmentHeadcountMap = new Map();

  // Calculate headcount for each department
  for (const employee of employeeData.values()) {
    if (includePastEmployees || !employee.profiles_departure_date) {
      const deptId = employee.profiles_category_200009617;
      if (departmentData.find(dept => dept.id === deptId)) {
        // Increment headcount in the map
        departmentHeadcountMap.set(deptId, (departmentHeadcountMap.get(deptId) || 0) + 1);
      }
    }
  }

  // Update departments with calculated headcounts
  for (const department of departmentData) {
    department.departmentHeadcount = departmentHeadcountMap.get(department.id) || 0;
  }

  // Filter out departments with zero current employees if includePastEmployees is not true
  const filteredDepartments = includePastEmployees 
    ? departmentData 
    : departmentData.filter(department => department.departmentHeadcount > 0)
                    .filter(department => department != null); // Ensure no null departments

  // Sort departments alphabetically by name while ensuring valid entries
  const validDepartments = filteredDepartments.filter(department => department && department.name);
  validDepartments.sort((a, b) => a.name.localeCompare(b.name));

  // Map to response format
  const departmentsResponse = validDepartments.map(department => ({
    id: department.id,
    name: department.name,
    departmentHeadcount: department.departmentHeadcount,
    averageTenureInMonths: department.averageTenureInMonths
  }));

  // Improved error handling (if no departments are found)
  if (departmentsResponse.length === 0) {
    const errorMessage = includePastEmployees 
      ? "No departments found."
      : "No departments found with active employees.";
    Logger.log(`Error in getDepartments: ${errorMessage}`);
    return {
      error: errorMessage,
      status: 404  // Or potentially a different status code, depending on your API design
    };
  }

  return { departments: departmentsResponse };
}
/**
   * Entry point for the web app, routes requests to the appropriate endpoint.
   */
function doGet(e) {
  Logger.log(arguments.callee.name); // DEBUG

  // Log request details (for debugging)
  if (e) {
    Logger.log("Event Object: " + JSON.stringify(e));
    if (e.request && e.request.headers) {
      Logger.log("Request Headers: " + JSON.stringify(e.request.headers));
    } else {
      Logger.log("No request headers found.");
    }
  }

  const lastRefresh = new Date(PropertiesService.getScriptProperties().getProperty('lastRefresh'));
  if (employeeData.size === 0 || (new Date() - lastRefresh) > 24 * 60 * 60 * 1000) { // 24 hours
    loadData();
  }

  // 2. Determine the endpoint based on the URL path
  let path = e.pathInfo; // Get the path directly from the request object

  // 3. Parse employeeId or departmentName from the path (if applicable)
  let employeeId, departmentName;

  // Check if 'path' exists before using 'startsWith'
  if (path) {
    if (path.startsWith("employees/")) {
      employeeId = path.substring("employees/".length);
      path = "employees/{employeeId}";
    } else if (path.startsWith("departments/")) {
      departmentName = path.substring("departments/".length);
      path = "departments/{departmentName}";
    }
  } else {
    Logger.log("Error in doGet: pathInfo is undefined.");
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid request: Missing path information.", status: 400 }))
      .setMimeType(ContentService.MimeType.JSON); // Return a 400 Bad Request error
  }

  // 4. Route the request to the appropriate endpoint function
  let response;
  try {
    switch (path) {
      case "employees":
        response = getEmployees(e);
        break;
      case "employees/{employeeId}":
        if (!employeeId || isNaN(employeeId)) {
          throw new Error("Invalid employeeId: " + employeeId); // Include invalid ID in the error message
        }
        e.parameter.employeeId = employeeId;
        response = getEmployee(e);
        break;
      case "departments":
        response = getDepartments(e);
        break;
      case "departments/{departmentName}":
        if (!departmentName) {
          throw new Error("Invalid departmentName: " + departmentName); // Include invalid name in the error message
        }
        e.parameter.departmentName = departmentName;
        response = getDepartmentByName(e);
        break;
      default:
        throw new Error("Invalid endpoint: " + path); // Include invalid path in the error message
    }
  } catch (error) {
    Logger.log("Error in doGet: " + error); // Log the error for debugging
    response = { error: error.message, status: 500 }; // Return a 500 Internal Server Error with the error message
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
function getDepartmentByName(e) {
  Logger.log(arguments.callee.name); // DEBUG
  const departmentNameOrId = e.parameter.departmentName;
  const includePastEmployees = e.parameter.includePastEmployees || 'false';

  // Find the department by name (case-insensitive) or ID
  let department = null;
  for (const dept of departments.values()) {
    if (dept.name && dept.name.toLowerCase() === departmentNameOrId.toLowerCase() || dept.id === departmentNameOrId) {
      department = dept;
      break;
    }
  }

  // If department not found, return an error with 404 status code
  if (!department) {
    const errorMessage = `Department not found with name or ID: ${departmentNameOrId}`;
    Logger.log(`Error in getDepartmentByName: ${errorMessage}`);
    return { error: errorMessage, status: 404 };
  }

  // Calculate departmentHeadcount, considering includePastEmployees
  let departmentHeadcount = 0;
  let totalTenureInMonths = 0;
  for (const employee of employeeData.values()) {
    if (employee.profiles_category_200009617 === department.id) {
      if (includePastEmployees === 'true' || !employee.profiles_departure_date) {
        departmentHeadcount++;
        totalTenureInMonths += employee.tenureInMonths;
      }
    }
  }

  let response = {};
  response.department = {
    id: department.id,
    name: department.name,
    departmentHeadcount: departmentHeadcount,
    averageTenureInMonths: departmentHeadcount > 0 ? Math.round(totalTenureInMonths / departmentHeadcount) : 0 // Handle potential division by zero
  };

  return response; // Return the plain JavaScript object
}
/**
 * dk! TODO: fix and enhance tests
 */
function runTests() {
  Logger.log(Session.getActiveUser().getEmail())

  const lastRefresh = new Date(PropertiesService.getScriptProperties().getProperty('lastRefresh'));
  if (employeeData.size === 0 || (new Date() - lastRefresh) > 24 * 60 * 60 * 1000) { // 24 hours
    loadData();
  }

  let tokTest = decodeGCPToken(testToken);

  // Test case for getDepartments()
  const e = { parameter: { includePastEmployees: 'false' } }; // Simulate a request with includePastEmployees=false
  const response = getDepartments(e);
  const res = JSON.stringify(response);
  Logger.log(res)
  const expectedResponse = "xxx"
  /*
    {
      departments: [
        {id:'Development', 
        name: 'Development', 
        departmentHeadcount: 2, 
        */


  Logger.log("getDepartments() test:");
  Logger.log("  Actual: " + JSON.stringify(response));
  Logger.log("  Expected: " + JSON.stringify(expectedResponse));
  assert(JSON.stringify(response) === JSON.stringify(expectedResponse), "getDepartments() test failed");
}

/**
 * Decodes a GCP token by attempting to:
 * 1. Base64 decode it (if it's a JWT-like token).
 * 2. Query Google's OAuth2 token info endpoint.
 * @param {string} token The GCP token.
 * @return {object} Decoded information or error message.
 */
function decodeGCPToken(token) {
  try {
      // If it's not a JWT, fall back to Google's tokeninfo endpoint
      return fetchTokenInfo(token);
  } catch (error) {
    return {
      method: "Error",
      message: error.message
    };
  }
}

/**
 * Base64-url decoding helper function.
 * @param {string} str Base64-url encoded string.
 * @return {string} Decoded string.
 */
function decodeBase64Url(str) {
  // Replace URL-safe characters, and add padding if needed
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  var padding = str.length % 4 ? '==='.slice(str.length % 4) : '';
  var decoded = Utilities.base64Decode(str + padding);
  return Utilities.newBlob(decoded).getDataAsString();
}

/**
 * Fetch token information using Google's OAuth 2.0 Token Info endpoint.
 * @param {string} token The GCP token.
 * @return {object} Token information or error message.
 */
function fetchTokenInfo(token) {
  var url = 'https://oauth2.googleapis.com/tokeninfo?access_token=' + token;
  try {
    var response = UrlFetchApp.fetch(url);
    var result = JSON.parse(response.getContentText());
    return {
      method: "OAuth2 tokeninfo endpoint",
      tokenInfo: result
    };
  } catch (error) {
    return {
      method: "Error",
      message: "Failed to fetch token info: " + error.message
    };
  }
}

// Example usage
function testDecode() {
  var token = "ya29.c.c0ASRK0GZaOm-VAhWI4TQyKDFDHUHlaPPj3vx3BB8HDc5Ej0hJmm1YZbVCUIesvxjZJPTPCYuuLGO8r5I0PfRs5kFdmlaRaXS10cKso1gShzetRHa37cfiaEvsigF6fZTyFq1YOYrslQ3wE6KF6N14MkULRc-6jiFseD6LjmSuPD1iksz3T68tuJJxyqUCPT9vb0eMEp4NJWETpJGWCn1qgVI3pxXABOOWJFJXRLdFSIDeOO-YANH86XqvIaiQY8IlA3iktkWW27IEYzd8t_oRnmIL1-UT0YgZiMSdBvzA4y7QEw4AUiSNjs4rYRMMySL5y8ox5EAQrMU5LFU6hfqWTdzVzrfecaE55boehtvKeDZvqPLeOVaX-bdQJXHLN389K38Ba0j9ttZF7oJFZYb5mImibwyYijVhqVuWIqsvfnnJQk0Y8f0FU0htdMpYf7UX7UXiI-tirOvcXy-41Ibx0s-uhpW95B1ndMgBrSZyW4Xx1yIaYRpBZ5rMWFIjf1boiJi4vlijieOnvn1vgzmdvj-nofJfe0Yliv-eQ0wvZ4b_7zXrvgccOk_sghuVhWZsatd6Itevb9wogb5bSbSXS3uJnrBUXtpub3-J57V0UtYc4s3O8kX9Jct59kb3J7QOnio0_ewn0IVmpyfk4SR6y2qwn282J_Xuj-51tFwynUj5gsbl3f1kJzfY4m9_nk8he8ascwa4RZY18npeBcnVxjJQyXuF8qRM159o6ixF5VyOMWdyovvc9nQr44xg4410gaX9Sj66zv9JW4vFpO-2bpxZ270RjSdZWJrlffVYwFq0a7kiSnxb_2_tZ178uIYQoJ1V67Bzla6X9wbt4y7gv0R-u0z2rVombimM97znaJdlcM4qy4O_IeeVQdXjU_4jFhX32i8Rn-fU0O8tc90vIo6hfp3U5f4mFQBqXteyXxbs6w_i3XgVMgUFUrd9oyVjFrJ5WsvaQkgsvt4hjpmpWUseafc2U92fj9r1sy4vnmdxxWYihJbB0aB";
  var decoded = fetchTokenInfo(token);
  Logger.log(decoded);
}


function assert(condition, message) {
  if (!condition) {
    Logger.log("Assertion failed: " + message);
  }
}
