'use strict';

var createCredentialChain = require('./createCredentialChain');
var fromCognitoIdentity = require('./fromCognitoIdentity');
var fromCognitoIdentityPool = require('./fromCognitoIdentityPool');
var fromContainerMetadata = require('./fromContainerMetadata');
var fromEnv = require('./fromEnv');
var credentialProviderHttp = require('@aws-sdk/credential-provider-http');
var fromIni = require('./fromIni');
var fromInstanceMetadata = require('./fromInstanceMetadata');
var fromLoginCredentials = require('./fromLoginCredentials');
var fromNodeProviderChain = require('./fromNodeProviderChain');
var fromProcess = require('./fromProcess');
var fromSSO = require('./fromSSO');
var fromTemporaryCredentials = require('./fromTemporaryCredentials');
var fromTokenFile = require('./fromTokenFile');
var fromWebToken = require('./fromWebToken');



exports.fromHttp = credentialProviderHttp.fromHttp;
Object.prototype.hasOwnProperty.call(createCredentialChain, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: createCredentialChain['__proto__']
	});

Object.keys(createCredentialChain).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = createCredentialChain[k];
});
Object.prototype.hasOwnProperty.call(fromCognitoIdentity, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromCognitoIdentity['__proto__']
	});

Object.keys(fromCognitoIdentity).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromCognitoIdentity[k];
});
Object.prototype.hasOwnProperty.call(fromCognitoIdentityPool, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromCognitoIdentityPool['__proto__']
	});

Object.keys(fromCognitoIdentityPool).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromCognitoIdentityPool[k];
});
Object.prototype.hasOwnProperty.call(fromContainerMetadata, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromContainerMetadata['__proto__']
	});

Object.keys(fromContainerMetadata).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromContainerMetadata[k];
});
Object.prototype.hasOwnProperty.call(fromEnv, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromEnv['__proto__']
	});

Object.keys(fromEnv).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromEnv[k];
});
Object.prototype.hasOwnProperty.call(fromIni, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromIni['__proto__']
	});

Object.keys(fromIni).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromIni[k];
});
Object.prototype.hasOwnProperty.call(fromInstanceMetadata, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromInstanceMetadata['__proto__']
	});

Object.keys(fromInstanceMetadata).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromInstanceMetadata[k];
});
Object.prototype.hasOwnProperty.call(fromLoginCredentials, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromLoginCredentials['__proto__']
	});

Object.keys(fromLoginCredentials).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromLoginCredentials[k];
});
Object.prototype.hasOwnProperty.call(fromNodeProviderChain, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromNodeProviderChain['__proto__']
	});

Object.keys(fromNodeProviderChain).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromNodeProviderChain[k];
});
Object.prototype.hasOwnProperty.call(fromProcess, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromProcess['__proto__']
	});

Object.keys(fromProcess).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromProcess[k];
});
Object.prototype.hasOwnProperty.call(fromSSO, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromSSO['__proto__']
	});

Object.keys(fromSSO).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromSSO[k];
});
Object.prototype.hasOwnProperty.call(fromTemporaryCredentials, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromTemporaryCredentials['__proto__']
	});

Object.keys(fromTemporaryCredentials).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromTemporaryCredentials[k];
});
Object.prototype.hasOwnProperty.call(fromTokenFile, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromTokenFile['__proto__']
	});

Object.keys(fromTokenFile).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromTokenFile[k];
});
Object.prototype.hasOwnProperty.call(fromWebToken, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: fromWebToken['__proto__']
	});

Object.keys(fromWebToken).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = fromWebToken[k];
});
