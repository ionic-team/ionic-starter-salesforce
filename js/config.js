angular.module('config', [])

  .constant('forcengOptions', {})

  // baseURL should be left to empty string. This value is only used when you want to use the same app in a Visualforce
  // page where you have to account for the path to the static resource. In that case the config module is created from
  // within index.vf where the path to the static resource can be obtained.
  .constant('baseURL', '');

