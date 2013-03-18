(function() {

    var DEBUG = true;

    checkInspectedPage();

    function checkInspectedPage() {
        var scripts = document.scripts;
        for (var i = scripts.length; i--;) {
            var script = scripts[i];
            if (script.src && script.src.endsWith('codeschool_devtools_injected.js')) {
                var url = script.dataset.url;
                if (url === WebInspector.inspectedPageURL) {
                    setupListeners();
                } else {
                    console.warn('None of DevTools instances inspect Code School page');
                }
                break;
            }
        }
    }

    function setupListeners() {
        WebInspector.notifications.addEventListener(WebInspector.UserMetrics.UserAction, function(event) {
            var data = event.data;
            switch (data.action) {
                case 'forcedElementState':
                    emitAction(data, ['enabled', 'selector', 'state']);
                    break;

                case 'fileSaved':
                case 'revertRevision':
                case 'applyOriginalContent':
                case 'networkRequestSelected':
                    emitAction(data, ['url']);
                    break;

                case 'openSourceLink':
                    emitAction(data, ['url', 'lineNumber']);
                    break;

                case 'togglePrettyPrint':
                    emitAction(data, ['url', 'enabled']);
                    break;

                case 'setBreakpoint':
                    emitAction(data, ['url', 'line', 'enabled']);
                    break;

                case 'networkSort':
                    emitAction(data, ['column', 'sortOrder']);
                    break;

                case 'networkRequestTabSelected':
                    emitAction(data, ['url', 'tab']);
                    break;

                case 'heapSnapshotFilterChanged':
                    emitAction(data, ['label']);
                    break;

                default:
                    if (DEBUG) {
                        console.warn(JSON.stringify(data.action) + ' is ignored. ', data);
                    }
                    break;
            }
        });

        var profiles = WebInspector.panel('profiles');
        var startProfileButtonClicked = false;

        ['ProfileLauncherView', 'MultiProfileLauncherView'].forEach(function(className) {
            var classObject = WebInspector[className];
            if (!classObject) {
                console.warn('WebInspector.%s is missing', className);
                return;
            }
            var profileStarted = classObject.prototype.profileStarted;
            classObject.prototype.profileStarted = function() {
                console.info('click Start Profile');
                profileStarted.apply(this, arguments);
                startProfileButtonClicked = true;
            };

            // profileFinished fires on "clear all profiles", don't use it
        });

        var HeapSnapshotView_onSelectedViewChanged = WebInspector.HeapSnapshotView.prototype._onSelectedViewChanged;
        if (HeapSnapshotView_onSelectedViewChanged) {
            WebInspector.HeapSnapshotView.prototype._onSelectedViewChanged = function(event) {
                HeapSnapshotView_onSelectedViewChanged.apply(this, arguments);

                if (this._profileTypeId === 'HEAP') {
                    var target = event.target;
                    var label = target[target.selectedIndex].label;
                    emitAction({
                        action: 'heapSnapshotViewChange',
                        label: label
                    });
                }
            };
        } else {
            console.warn('WebInspector.HeapSnapshotView.prototype._onSelectedViewChanged is missing');
        }


        setupProfileListener();

        var profiles_reset = profiles._reset;
        if (profiles_reset) {
            profiles._reset = function() {
                console.info('reset');
                profiles_reset.apply(this, arguments);
                setupProfileListener();
            };
        } else {
            console.warn('profiles._reset is missing');
        }

        function setupProfileListener() {
            profiles.addEventListener('profile added', function(event) {
                console.info('Profile added');
                if (startProfileButtonClicked) {
                    emitAction({
                        action: 'profileAdded',
                        type: event.data.type
                    });
                    startProfileButtonClicked = false;
                }
            });
        }


        WebInspector.timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineStarted, function() {
            emitAction({
                action: 'timelineStarted'
            });
        });
        WebInspector.timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineStopped, function() {
            emitAction({
                action: 'timelineStopped'
            });
        });
        WebInspector.settings.consoleHistory.addChangeListener(function(event) {
            var data = event.data;
            if (!data || !data.length)
                return;
            var lastItem = data[data.length - 1];
            emitAction({
                action: 'consoleUserInput',
                data: lastItem
            });
        });
        WebInspector.settings.pauseOnExceptionStateString.addChangeListener(function(event) {
            emitAction({
                action: 'pauseOnException',
                state: event.data
            });
        });
    }

    function emitAction(data, allowedProperties) {
        if (!allowedProperties) {
            var object = data;
        } else {
            object = {action: data.action};
            for (var i = 0; i < allowedProperties.length; i++) {
                var key = allowedProperties[i];
                object[key] = data[key];
            }
        }
        window.postMessage({
            command: 'emit',
            url: WebInspector.inspectedPageURL,
            data: object
        }, '*');
    }

    /**
     * eval in web page context, e.g. CodeSchool page
     * @param {string} expression
     */
    function runtimeEval(expression) {
        // https://developers.google.com/chrome-developer-tools/docs/protocol/1.0/runtime#command-evaluate
        RuntimeAgent.evaluate(
            expression,
            /*objectGroup*/ '',
            /*includeCommandLineAPI*/ false,
            /*doNotPauseOnExceptionsAndMuteConsole*/ false,
            undefined,
            /*returnByValue*/ false,
            /*generatePreview*/ false,
            function evalCallback(x, result, wasThrown) {
                if (wasThrown) {
                    console.warn(result);
                }
            }
        );
    }

})();


//@ sourceURL=codeschool_devtools_injected.js
