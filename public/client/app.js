var myApp = angular.module('shortlyApp', []).config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when('/', {controller: "indexController", templateUrl: "client/views/index.html"})
  .when('/create', {controller: "createController", templateUrl: "client/views/create.html"})
  .when('/signup', {controller: "authController", templateUrl:"client/views/signup.html"})
  .when('/login', {controller: "authController", templateUrl:"client/views/login.html"})
})

myApp.run(function($location, $rootScope, authService) {
  $rootScope.$on('$routeChangeStart', function(event, next) {
    if ((!authService.currentUserID) && (next.controller !== "authController")) {
      $location.path('/login');
    }
  })
});

myApp.factory('authService', function($q, $http) {
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
    })
    return d.promise;
  };

  return service;
})

myApp.controller("indexController", function($scope, $http, $location, $rootScope) {

  $http({
    method: "get", 
    url: "/links"
  })
  .success(function (data){
    for (var i = 0; i < data.length; i++) {
      var link = data[i];
      link.title = (link.title.length > 50 ? link.title.slice(0,48) + "..." : link.title);
      while (link.title[0] === " ") {link.title = link.title.slice(1);}
      link.timeAgo = formatTime(link.updated_at)[0];
      link.timeUnits = formatTime(link.updated_at)[1];      
    }
    $rootScope.links = data;
  })
  .error(function (data){
    console.log("Failed get request.");
  });

});

myApp.controller("createController", function($scope, $http, $rootScope) {  
  $scope.doShit = function(url) {     
    url = url.replace(/^https?\:\/\//, '').replace(/^www./,'');
    url = "http://" + url;
    for (var i = 0; i < $rootScope.links.length; i++){
      var link = $rootScope.links[i];
      if (link.url === url){
        $scope.message = "LAME";
        return;
      }
    }

    $scope.working = true;
    $http({
      url: '/links',
      method: 'post',
      data: {url: url}
    }).
    success(function (data, status) {
      $scope.link = data;
      $scope.working = false;
    }).error(function(data) {
      $scope.working = false;
      $scope.message = "FAILURE";
    });
  }

  $scope.shorten = function(url){
    if (url && url.length) {
      $scope.message = undefined;
      if (!$rootScope.links) {
        $http({
          method: "get", 
          url: "/links"
        })
        .success(function (data){
          for (var i = 0; i < data.length; i++) {
            var link = data[i];
            link.title = (link.title.length > 50 ? link.title.slice(0,48) + "..." : link.title);
            while (link.title[0] === " ") {link.title = link.title.slice(1);}
            link.timeAgo = formatTime(link.updated_at)[0];
            link.timeUnits = formatTime(link.updated_at)[1];      
          }
          $rootScope.links = data;
          $scope.doShit(url);
        })
        .error(function (data){
          console.log("Failed get request.");
        });
      } else { $scope.doShit(url); }
    }
  }
});

myApp.controller("statsController", function($scope, $http, $location) {
  $http({
    method: "get",
    url: $location.path()
  })
  .success(function (data) {
    $scope.clicks = data.clicks;
    $scope.title = data.title;
  });
});

myApp.controller("authController", function(authService, $scope, $http, $location) {
  $scope.login = function() {
    if ($scope.user.username && $scope.user.password) $scope.auth('login');
  };

  $scope.signup = function() {
    if ($scope.user.username && $scope.user.password) $scope.auth('signup');
  };

  $scope.auth = function(type) {
    authService.auth(type, $scope.user.username, $scope.user.password)
    .then(
      function(data) {authService.currentUserID = data.identifier; $location.path('/')},
      function(errData) {$scope.error = errData.error; }
    );
  }
});

formatTime = function(time) {
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
