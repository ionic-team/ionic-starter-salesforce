This is a starter pack for building Ionic apps that use the full power of the Salesforce platform.

Created as a partnership between Salesforce and Ionic, this starter project
is a perfect fit for developers building Salesforce apps at the [Dreamforce](http://www.salesforce.com/dreamforce/DF14/) [$1M hackathon](https://developer.salesforce.com/million-dollar-hackathon), or building on the Salesforce platform.

This is an addon starter template for the [Ionic Framework](http://ionicframework.com/).

## How to use this template

To use this, you'll need to have [installed Ionic](http://ionicframework.com/getting-started) and Cordova:

```bash
$ sudo npm install -g ionic cordova
```

Then, all you need to do is run:
```
$ ionic start myApp salesforce
```

After that, we will add the Salesforce OAuth plugin:

```bash
$ cordova plugin add https://github.com/forcedotcom/SalesforceMobileSDK-CordovaPlugin
```

Then, to run it, cd into `myApp` and run:

```bash
$ ionic platform add ios
$ ionic build ios
$ ionic emulate ios
```

Substitute ios for android if not on a Mac, but if you can, the ios development toolchain is a lot easier to work with until you need to do anything custom to Android.

