Starter pack for building Ionic apps on top of the Salesforce platform created as a partnership between Ionic and Salesforce.

This is an addon starter template for the [Ionic Framework](http://ionicframework.com/). The template installs a starter application that uses Salesforce OAuth to authenticate, and the Salesforce REST APIs to access and manipulate Salesforce data.

## How to use this template

To use this starter pack, you'll need to have [installed Ionic](http://ionicframework.com/getting-started) and Cordova:

```bash
$ sudo npm install -g ionic cordova
```

Then, all you need to do is run:
```
$ ionic start myApp salesforce
$ cd myApp
$ ionic platforms update ios
$ ionic plugin add https://github.com/forcedotcom/SalesforceMobileSDK-CordovaPlugin
```

## Running on device

Substitute ios for android in the instructioons below, but if you can, the ios development toolchain is a lot easier to work with until you need to do anything custom to Android.

1. Build the project:

    ```bash
    $ ionic build ios
    ```

1. Run the app in the emulator

    ```bash
    $ ionic emulate ios
    ```

1. ... or (for iOS) open **platforms/ios/myApp.xcodeproj** in Xcode and run the app on your device. If the build fails in Xcode, select the myApp target, click the **Build Settings** tab, search for **bitcode**, select **No** for **Enable Bitcode**, and try again.


## Running in the browser

Because of the browser's cross-origin restrictions, your Ionic application hosted on your own server (or localhost) will not be able to make API calls directly to the *.salesforce.com domain. The solution is to proxy your API calls through your own server. You can use your own proxy server or use [ForceServer](https://github.com/ccoenraets/force-server), a simple development server for Force.com. It provides two main features:

- A **Proxy Server** to avoid cross-domain policy issues when invoking Salesforce REST services. (The Chatter API supports CORS, but other APIs don’t yet)
- A **Local Web Server** to (1) serve the OAuth callback URL defined in your Connected App, and (2) serve the whole app during development and avoid cross-domain policy issues when loading files (for example, templates) from the local file system.

To run the application in the browser using ForceServer:

1. Install ForceServer

    ```bash
    $ sudo npm install -g force-server
    ```

2. Navigate (cd) to your Ionic app's **www** directory  

3. Start the server

    ```
    force-server
    ```

    This command will start the server on port 8200, and automatically load your app (http://localhost:8200) in a browser window. You'll see the Salesforce login window (make sure you enable the popup), and the list of contacts will appear after you log in. If you don’t have a free Salesforce Developer Edition to log in to, you can create one [here](http://developer.salesforce.com/signup).

    You can change the port number and the web root. Type the following command for more info:

    ```
    force-server --help
    ```

## OAuth and REST

This template uses [forceng](https://github.com/ccoenraets/forceng), a micro-library that makes it easy to use the Salesforce REST APIs in AngularJS applications. forceng allows you to easily login into Salesforce using OAuth, and to access your Salesforce data using a simple API.
