var server = {};

(function (server) {
    var SERVER = 'server';

    var SYSTEM_REGISTRY = 'system.registry';

    var ANONYMOUS_REGISTRY = 'anonymous.registry';

    var USER_MANAGER = 'user.manager';

    var SERVER_OPTIONS = 'server.options';

    var SERVER_EVENTS = 'server.events';

    var TENANT_CONFIGS = 'tenant.configs';

    var USER = 'server.user';

    /**
     * Initializes the server for the first time. This should be called when app is being deployed.
     * @param options
     */
    server.init = function (options) {
        var carbon = require('carbon'),
            event = require('event'),
            srv = new carbon.server.Server({
                tenanted: options.tenanted,
                url: options.server.https
            });
        application.put(SERVER, srv);
        application.put(SERVER_OPTIONS, options);

        application.put(TENANT_CONFIGS, {});

        event.on('tenantCreate', function (tenantId) {

        });

        event.on('tenantLoad', function (tenantId) {
            var loader,
                log = new Log(),
                carbon = require('carbon'),
                config = server.configs(tenantId);

            //initialize tenant registry
            loader = carbon.server.osgiService('org.wso2.carbon.registry.core.service.TenantRegistryLoader');
            loader.loadTenantRegistry(tenantId);

            //loads tenant's system registry
            config[SYSTEM_REGISTRY] = new carbon.registry.Registry(server.instance(), {
                system: true,
                tenantId: tenantId
            });
            //loads tenant's anon registry
            config[ANONYMOUS_REGISTRY] = new carbon.registry.Registry(server.instance(), {
                tenantId: tenantId
            });
            //loads tenant's user manager
            config[USER_MANAGER] = new carbon.user.UserManager(server.instance(), tenantId);
        });

        event.on('tenantUnload', function (tenantId) {
            var config = server.configs(tenantId);
            delete config[tenantId];
        });

        event.on('login', function (tenantId, user, session) {
            //we check the existence of user manager in the application ctx and
            //decide whether tenant has been already loaded.
            /*log.info('login : ' + tenantId + ' User : ' + JSON.stringify(user));
             if (application.get(tenantId + USER_MANAGER)) {
             //return;
             }
             event.emit('tenantCreate', tenantId);
             event.emit('tenantLoad', tenantId);*/
            var carbon = require('carbon'),
                loginManager = carbon.server.osgiService('org.wso2.carbon.core.services.callback.LoginSubscriptionManagerService'),
                configReg = server.systemRegistry(tenantId).registry.getChrootedRegistry("/_system/config"),
                domain = carbon.server.tenantDomain({
                    tenantId: tenantId
                });
            loginManager.triggerEvent(configReg, user.username, tenantId, domain);
        });
    };

    /**
     * This is just a util method. You need to validate the tenant before you use.
     * So, USE WITH CARE.
     * @param request
     * @param session
     */
    server.tenant = function (request, session) {
        var obj, domain, user, matcher,
            opts = server.options(),
            carbon = require('carbon');
        if (!opts.tenanted) {
            return {
                tenantId: carbon.server.superTenant.tenantId,
                domain: carbon.server.superTenant.domain,
                secured: false
            };
        }
        /*matcher = new URIMatcher(request.getRequestURI());
         if (matcher.match('/{context}/' + opts.tenantPrefix + '/{domain}') ||
         matcher.match('/{context}/' + opts.tenantPrefix + '/{domain}/{+any}')) {
         domain = matcher.elements().domain; */
        domain = request.getParameter('domain');
        user = server.current(session);
        if (user) {
            obj = {
                tenantId: user.tenantId,
                domain: user.domain,
                secured: true
            };
        } else {
            carbon = require('carbon');
            obj = {
                tenantId: carbon.server.tenantId({
                    domain: domain
                }),
                domain: domain,
                secured: false
            };
        }
        //loads the tenant if it hasn't been loaded
        server.loadTenant(obj.tenantId);
        return obj;
    };

    server.loadTenant = function (tenantId) {
        var config = server.configs(tenantId);
        if (config[ANONYMOUS_REGISTRY]) {
            return;
        }
        require('event').emit('tenantLoad', tenantId);
    };

    /**
     * Returns server options object.
     * @return {Object}
     */
    server.options = function () {
        return application.get(SERVER_OPTIONS);
    };

    /**
     * Returns the server instance.
     * @return {Object}
     */
    server.instance = function () {
        return application.get(SERVER);
    };

    /**
     * Checks whether server runs on multi-tenanted mode.
     * @return {*}
     */
    server.tenanted = function () {
        return server.options().tenanted;
    };

    /**
     * Loads the tenant configs object or the tenant config of the given tenant.
     * @param tenantId
     * @return {*}
     */
    server.configs = function (tenantId) {
        var config = application.get(TENANT_CONFIGS);
        if (!tenantId) {
            return config;
        }
        return config[tenantId] || (config[tenantId] = {});
    };

    /**
     * Returns the system registry of the given tenant.
     * @param tenantId
     * @return {Object}
     */
    server.systemRegistry = function (tenantId) {
        var carbon,
            config = server.configs(tenantId);
        if (!config || !config[SYSTEM_REGISTRY]) {
            carbon = require('carbon');
            return new carbon.registry.Registry(server.instance(), {
                system: true,
                tenantId: tenantId
            });
        }
        return server.configs(tenantId)[SYSTEM_REGISTRY];
    };

    /**
     * Returns the anonymous registry of the given tenant.
     * @param tenantId
     * @return {Object}
     */
    server.anonRegistry = function (tenantId) {
        var carbon,
            config = server.configs(tenantId);
        if (!config || !config[ANONYMOUS_REGISTRY]) {
            carbon = require('carbon');
            return new carbon.registry.Registry(server(), {
                tenantId: tenantId
            });
        }
        return server.configs(tenantId)[ANONYMOUS_REGISTRY];
    };


    /**
     * Returns the currently logged in user
     */
    server.current = function (session, user) {
        if (arguments.length > 1) {
            session.put(USER, user);
            return user;
        }
        return session.get(USER);
    };

    /**
     * Returns the user manager of the given tenant.
     * @param tenantId
     * @return {*}
     */
    server.userManager = function (tenantId) {
        var carbon,
            config = server.configs(tenantId);
        if (!config || !config[USER_MANAGER]) {
            carbon = require('carbon');
            return new carbon.user.UserManager(server(), tenantId);
        }
        return server.configs(tenantId)[USER_MANAGER];
    };
}(server));
