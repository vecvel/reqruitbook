// Decorator metadata is emitted at compile time but only readable when the
// reflect-metadata polyfill has been installed, so it must load before any
// module that carries a decorator.
require('reflect-metadata');
