fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios upload_metadata

```sh
[bundle exec] fastlane ios upload_metadata
```

Upload metadata to App Store Connect

### ios upload_screenshots

```sh
[bundle exec] fastlane ios upload_screenshots
```

Upload screenshots to App Store Connect

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Upload build to TestFlight

### ios release

```sh
[bundle exec] fastlane ios release
```

Upload everything: metadata + TestFlight build

### ios download_metadata

```sh
[bundle exec] fastlane ios download_metadata
```

Download current metadata from App Store Connect

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Take screenshots (if you have UI tests set up)

----


## Android

### android upload_metadata

```sh
[bundle exec] fastlane android upload_metadata
```

Upload metadata to Google Play (requires existing release)

### android internal

```sh
[bundle exec] fastlane android internal
```

Upload AAB to internal testing track with metadata

### android beta

```sh
[bundle exec] fastlane android beta
```

Upload AAB to beta testing track (closed)

### android release

```sh
[bundle exec] fastlane android release
```

Upload everything: AAB + metadata to internal testing

### android download_metadata

```sh
[bundle exec] fastlane android download_metadata
```

Download current metadata from Google Play

### android promote_to_beta

```sh
[bundle exec] fastlane android promote_to_beta
```

Promote internal build to beta

### android promote_to_production

```sh
[bundle exec] fastlane android promote_to_production
```

Promote beta build to production

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
