var myApp = angular.module('shortlyApp', []).config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when('/', {controller: "indexController", templateUrl: "client/views/index.html"})
  .when('/create', {controller: "createController", templateUrl: "client/views/create.html"})
  .when('/signup', {controller: "authController", templateUrl:"client/views/signup.html"})
  .when('/stats/:code', {controller: "statsController", templateUrl:"client/views/stats.html"})
  .when('/login', {controller: "authController", templateUrl:"client/views/login.html"});
})

.run(function($location, $rootScope, authService) {
  $rootScope.$on('$routeChangeStart', function(event, next) {
    if ((!authService.currentUserID) && (next.controller !== "authController")) {
      $location.path('/login');
    }
  });
})

.directive('ngEnter', function() {
  return function(scope, element, attrs) {
    element.bind("keydown keypress", function(event) {
      if(event.which === 13) {
        scope.$apply(function(){
          scope.$eval(attrs.ngEnter);
        });

        event.preventDefault();
      }
    });
  };
})

.factory('authService', function($q, $http) {
  var service = {};

  service.currentUserID = null;

  service.isAuthenticated = function() {
    return !!service.currentUserID;
  };

  service.auth = function(login_or_signup, username, password) {
    var d = $q.defer();
    $http({
      url: "/" + login_or_signup,
      method: 'post',
      data: {
        username: username,
        password: password
      }
    }).success(function (data) {
      d.resolve(data);
    }).error(function (err) {
      d.reject(err);
    });
    return d.promise;
  };

  return service;
})

.factory('linksService', function($q, $http) {
  var service = {};

  service.links = [];

  service.formatTime = function(time) {
    var seconds = ~~((new Date() - new Date(time)) / 1000),
        timeValues = [{"week": 604800}, {"day": 86400}, {"hour": 3600}, {"min": 60}, {"sec": 1}],
        output = "";
    for (var i = 0; i < timeValues.length; i++) {
      x = timeValues[i];
      for (var unit in x) {
        var goesInto = Math.floor(seconds / x[unit]);
        if (goesInto !== 0) {
          return [goesInto, unit + ((goesInto !== 1) && (unit !== "sec") ? 's' : '')];
        }
        seconds = seconds % x[unit];
      }
    }
    return [0, "sec"];
  };

  // Get all shortened links from the server.
  service.getLinks = function(noOverride) {
    var d = $q.defer();
    if (noOverride && service.links.length) {
      d.resolve();
    } else {
      $http({
        url: '/links',
        method: 'get'
      }).success(function (data) {
        for (var i = 0; i < data.length; i++) {
          var link = data[i];
          link.title = (link.title.length > 50 ? link.title.slice(0,48) + "..." : link.title).trim();
          link.timeAgo = service.formatTime(link.updated_at)[0];
          link.timeUnits = service.formatTime(link.updated_at)[1];
        }
        service.links = data;
        d.resolve();
      }).error(function (err) {
        d.reject(err);
      });
    }
    return d.promise;
  };

  service.createLink = function(url) {
    var d = $q.defer();
    service.getLinks(true).then( // We check if we've downloaded links yet.  No request is made if we've already gotten links.
      function() {
        if (url.slice(0, 10).indexOf('://') === -1) url = "http://" + url;
        for (var i = 0; i < service.links.length; i++) {
          if (service.links[i].url === url) {
            d.reject("Link already exists.");
          }
        }
        $http({
          method: 'post',
          url: 'links',
          data: {url: url}
        })
        .success(function(data) {
          d.resolve(data);
        })
        .error(function(err) {
          d.reject(err);
        });
      },
      function(err) {
        d.reject(err);
      }
    );
    return d.promise;
  };

  return service;
})

.controller("indexController", function(linksService, $http, $location, $scope) {

  linksService.getLinks().then(
    function() {
      $scope.links = linksService.links;
    },
    function(err) {
      console.log(err);
    }
  );

})

.controller("createController", function(linksService, $scope, $http, $rootScope) {

  $scope.shorten = function() {
    if ($scope.url && $scope.url.length) {
      $scope.message = undefined;
      linksService.createLink($scope.url).then(
        function(data) {
          $scope.link = data;
        },
        function(err) {
          $scope.message = err;
        }
      );
    }
  };

})

.controller("statsController", function($scope, $http, $location) {
  console.log("requesting stats");
  $http({
    method: "get",
    url: $location.path()
  })
  .success(function (data) {
    $scope.clicks = data.clicks;
    $scope.title = data.title;
  });
})

.controller("authController", function(authService, $scope, $http, $location) {
  $scope.login = function() {
    if ($scope.user.username && $scope.user.password) $scope.auth('login');
  };

  $scope.signup = function() {
    if ($scope.user.username && $scope.user.password) $scope.auth('signup');
  };

  $scope.auth = function(type) {
    authService.auth(type, $scope.user.username, $scope.user.password)
    .then(
      function(data) {authService.currentUserID = data.identifier; $location.path('/');},
      function(errData) {$scope.error = errData.error; }
    );
  };
});
