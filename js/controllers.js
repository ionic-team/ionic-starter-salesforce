angular.module('starter.controllers', ['forceng'])

    .controller('ContactListCtrl', function ($scope, force) {

        force.query('select id, name from contact limit 50').then(
            function (data) {
                $scope.contacts = data.records;
            },
            function () {
                alert("An error has occurred. See console for details.");
            });

    })

    .controller('ContactCtrl', function ($scope, $stateParams, force) {

        force.retrieve('contact', $stateParams.contactId, 'id,name,title,phone,mobilephone,email').then(
            function (contact) {
                $scope.contact = contact;
            },
            function() {
                alert("An error has occurred. See console for details.");
            });


    })

    .controller('AccountListCtrl', function ($scope, force) {

        force.query('select id, name from account limit 50').then(
            function (data) {
                $scope.accounts = data.records;
            },
            function () {
                alert("An error has occurred. See console for details.");
            });

    })

    .controller('AccountCtrl', function ($scope, $stateParams, force) {

        force.retrieve('account', $stateParams.accountId, 'id,name,phone,billingaddress').then(
            function (account) {
                console.log(account);
                $scope.account = account;
            },
            function() {
                alert("An error has occurred. See console for details.");
            });

    });
