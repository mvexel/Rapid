describe('maprules', function() {
    var _ruleChecks, _savedAreaKeys, validationRules;

    before(function() {
        _savedAreaKeys = Rapid.osmAreaKeys;
        Rapid.osmSetAreaKeys({ building: {}, amenity: {} });

        Rapid.services.maprules = Rapid.serviceMapRules;
        Rapid.serviceMapRules.init();
        _ruleChecks = Rapid.serviceMapRules.ruleChecks();
    });

    after(function() {
        Rapid.osmSetAreaKeys(_savedAreaKeys);
        delete Rapid.services.maprules;
    });

    describe('#filterRuleChecks', function() {
        it('returns shortlist of mapcss checks relevant to provided selector', function() {
            var selector = {
                geometry: 'closedway',
                equals: {amenity: 'marketplace'},
                absence: 'name',
                error: '\'Marketplace\' preset must be coupled with name'
            };
            var filteredChecks = Rapid.serviceMapRules.filterRuleChecks(selector);
            var equalsCheck = filteredChecks[0];
            var absenceCheck = filteredChecks[1];
            var entityTags = { amenity: 'marketplace' };

            expect(filteredChecks.length).eql(2);
            expect(equalsCheck(entityTags)).to.be.true;
            expect(absenceCheck(entityTags)).to.be.true;
        });
    });

    describe('#buildTagMap', function() {
        it('builds a map of tag keys/values found in mapcss selector', function() {
            [
                {
                    t: {
                        equals: {
                            man_made: 'tower',
                            'tower:type': 'communication'
                        }
                    },
                    r: {
                        man_made: ['tower'],
                        'tower:type': ['communication']
                    }
                },
                {
                    t: {
                        equals: {
                            building: 'yes',
                            amenity: 'school'
                        },
                        positiveRegex: {
                            opening_hours: [
                                '24/7',
                                'sunrise_sundown'
                            ]
                        },
                        negativeRegex: {
                            source: [
                                'missing_maps',
                                'american_red_cross'
                            ]
                        },
                        greaterThanEqual: { floors: 2 },
                        lessThanEqual: { floors: 4 }

                    },
                    r: {
                        building: ['yes'],
                        amenity: ['school'],
                        opening_hours: ['24/7', 'sunrise_sundown'],
                        source: ['missing_maps', 'american_red_cross'],
                        floors: [4, 2]
                    }
                },
                {
                    t: {
                        equals: { highway: 'yes' },
                        greaterThan: { lanes: 1 },
                        lessThan: { lanes: 4 }
                    },
                    r: {
                        highway: ['yes'],
                        lanes: [4, 1]
                    }
                }
            ].forEach(function(test) {
                expect(Rapid.serviceMapRules.buildTagMap(test.t)).to.eql(test.r);
            });
        });
    });

    describe('#inferGeometry', function() {
        it('infers geometry using selector keys', function() {

            var amenityDerivedArea = {
                geometry: 'closedway',
                presence: 'amenity',
                positiveRegex: { amenity: ['^school$', '^healthcare$'] },
                error: 'amenity cannot be healthcare or school!'
            };

            var areaDerivedArea = {
                geometry: 'closedway',
                equals: { area: 'yes' },
            };

            var badAreaDerivedLine = {
                geometry: 'closedway',
                equals: { 'area': 'no' }
            };

            var roundHouseRailwayDerivedArea = {
                geometry: 'closedway',
                equals: { 'railway': 'roundhouse' }
            };

            var justClosedWayDerivedLine = {
                geometry: 'closedway'
            };

            var tagMap, geom;
            tagMap = Rapid.serviceMapRules.buildTagMap(amenityDerivedArea);
            geom = Rapid.serviceMapRules.inferGeometry(tagMap);
            expect(geom).to.be.eql('area');

            tagMap = Rapid.serviceMapRules.buildTagMap(areaDerivedArea);
            geom = Rapid.serviceMapRules.inferGeometry(tagMap);
            expect(geom).to.be.eql('area');

            tagMap = Rapid.serviceMapRules.buildTagMap(badAreaDerivedLine);
            geom = Rapid.serviceMapRules.inferGeometry(tagMap);
            expect(geom).to.be.eql('line');

            tagMap = Rapid.serviceMapRules.buildTagMap(roundHouseRailwayDerivedArea);
            geom = Rapid.serviceMapRules.inferGeometry(tagMap);
            expect(geom).to.be.eql('area');

            tagMap = Rapid.serviceMapRules.buildTagMap(justClosedWayDerivedLine);
            geom = Rapid.serviceMapRules.inferGeometry(tagMap);
            expect(geom).to.be.eql('line');
        });
    });

    describe('#addRule', function() {
        it('builds a rule from provided selector and adds it to _validationRules', function () {
            var selector = {
                geometry:'node',
                equals: {amenity:'marketplace'},
                absence:'name',
                warning:'\'Marketplace\' preset must be coupled with name'
            };
            expect(Rapid.serviceMapRules.validationRules()).to.be.empty;
            Rapid.serviceMapRules.addRule(selector);
            expect(Rapid.serviceMapRules.validationRules().length).to.eql(1);
        });
    });
    describe('#clearRules', function() {
        it('clears _validationRules array', function() {
            expect(Rapid.serviceMapRules.validationRules().length).to.eql(1);
            Rapid.serviceMapRules.clearRules();
            expect(Rapid.serviceMapRules.validationRules()).to.be.empty;
        });
    });

    describe('#validationRules', function() {
        it('returns _validationRules array', function() {
            var selector = {
                geometry: 'closedway',
                equals: {amenity: 'marketplace'},
                absence: 'name',
                error: '\'Marketplace\' preset must be coupled with name'
            };
            Rapid.serviceMapRules.addRule(selector);
            var rules = Rapid.serviceMapRules.validationRules();
            expect(rules).instanceof(Array);
            expect(rules.length).to.eql(1);
        });
    });

    describe('_ruleChecks', function () {
        describe('#equals', function() {
            it('is true when two tag maps intersect', function() {
                var a = { amenity: 'school' };
                var b = { amenity: 'school' };
                expect(_ruleChecks.equals(a)(b)).to.be.true;
            });
            it('is false when two tag maps intersect', function() {
                var a = { man_made: 'water_tap' };
                var b = { amenity: 'school' };
                expect(_ruleChecks.equals(a)(b)).to.be.false;
            });
        });
        describe('#notEquals', function() {
            it('is true when two tag maps do not intersect', function() {
                var a = { man_made: 'water_tap' };
                var b = { amenity: 'school' };
                expect(_ruleChecks.notEquals(a)(b)).to.be.true;
            });
            it('is not true when two tag maps intersect', function() {
                var a = { amenity: 'school' };
                var b = { amenity: 'school', opening_hours: '9-5' };
                expect(_ruleChecks.notEquals(a)(b)).to.be.false;
            });
        });
        describe('absence', function() {
            it('is true when tag map keys does not include key in question', function() {
                var key = 'amenity';
                var map = { building: 'yes' };
                expect(_ruleChecks.absence(key)(map)).to.be.true;
            });
            it('is false when tag map keys does include key in question', function() {
                var key = 'amenity';
                var map = { amenity: 'school' };
                expect(_ruleChecks.absence(key)(map)).to.be.false;
            });
        });
        describe('presence', function() {
            it('is true when tag map keys includes key in question', function() {
                var key = 'amenity';
                var map = { amenity: 'school'};
                expect(_ruleChecks.presence(key)(map)).to.be.true;
            });
            it('is false when tag map keys do not include key in question', function() {
                var key = 'amenity';
                var map = { building: 'yes'};
                expect(_ruleChecks.presence(key)(map)).to.be.false;
            });
        });
        describe('greaterThan', function() {
            it('is true when a tag value is greater than the selector value', function() {
                var selectorTags = { lanes: 5 };
                var tags = { lanes : 6 };
                expect(_ruleChecks.greaterThan(selectorTags)(tags)).to.be.true;
            });
            it('is false when a tag value is less than or equal to the selector value', function() {
                var selectorTags = { lanes: 5 };
                [4, 5].forEach(function(val) {
                    expect(_ruleChecks.greaterThan(selectorTags)({ lanes: val })).to.be.false;
                });
            });
        });
        describe('greaterThanEqual', function() {
            it('is true when a tag value is greater than or equal to the selector value', function() {
                var selectorTags = { lanes: 5 };
                [5, 6].forEach(function(val) {
                    expect(_ruleChecks.greaterThanEqual(selectorTags)({ lanes: val })).to.be.true;
                });
            });
            it('is false when a tag value is less than the selector value', function () {
                var selectorTags = { lanes: 5 };
                var tags = { lanes: 4 };
                expect(_ruleChecks.greaterThanEqual(selectorTags)(tags)).to.be.false;
            });
        });
        describe('lessThan', function() {
            it('is true when a tag value is less than the selector value', function() {
                var selectorTags = { lanes: 5 };
                var tags = { lanes: 4 };
                expect(_ruleChecks.lessThan(selectorTags)(tags)).to.be.true;
            });
            it('is false when a tag value is greater than or equal to the selector value', function() {
                var selectorTags = { lanes: 5 };
                [6, 7].forEach(function(val) {
					expect(_ruleChecks.lessThan(selectorTags)({ lanes: val })).to.be.false;
				});
            });
        });
        describe('lessThanEqual', function() {
            it('is true when a tag value  is less than or equal to the selector value', function() {
                var selectorTags = { lanes: 5 };
                [4, 5].forEach(function(val) {
                    expect(_ruleChecks.lessThanEqual(selectorTags)({ lanes: val })).to.be.true;
                });
            });
            it('is false when a tag value is greater than the selector value', function() {
               var selectorTags = { lanes: 5 };
               var tags = { lanes: 6 };
               expect(_ruleChecks.lessThanEqual(selectorTags)(tags)).to.be.false;
            });
        });
        describe('positiveRegex', function() {
            var positiveRegex = { amenity: ['^hospital$','^clinic$']};
            it('is true when tag value matches positiveRegex', function() {
                var tags = { amenity: 'hospital' };
                expect(_ruleChecks.positiveRegex(positiveRegex)(tags)).to.be.true;
            });
            it('is false when tag value does not match negative regex', function() {
                var tags = { amenity: 'school' };
                expect(_ruleChecks.positiveRegex(positiveRegex)(tags)).to.be.false;
            });
        });
        describe('negativeRegex', function() {
            var negativeRegex = { bicycle: [ 'use_path', 'designated' ] };
            it('is true when tag value does not match negativeRegex', function() {
                var tags = { bicycle: 'yes' };
                expect(_ruleChecks.negativeRegex(negativeRegex)(tags)).to.be.true;
            });
            it('is false when tag value matches negativeRegex', function() {
                var tags = { bicycle: 'designated' };
                expect(_ruleChecks.negativeRegex(negativeRegex)(tags)).to.be.false;
            });
        });
    });
    describe('rule', function() {
        var selectors;
        before(function() {
            selectors = [
                {
                    geometry:'node',
                    equals: {amenity:'marketplace'},
                    absence:'name',
                    error:'\'Marketplace\' preset must be coupled with name'
                },
                {
                    geometry: 'closedway',
                    notEquals: { building: 'yes', amenity: 'clinic' },
                    error: '\'Clinic\' preset must be coupled with building=yes'
                },
                {
                    geometry:'node',
                    equals: {man_made: 'tower', 'tower:type': 'communication'},
                    presence: 'height',
                    error:'\'Communication Tower\' preset must not be coupled with height'
                },
                {
                    geometry: 'node',
                    equals: { man_made: 'tower' },
                    lessThanEqual: { height: 6 },
                    error: '\'Tower\' preset height must be greater than 6'
                },
                {
                    geometry: 'node',
                    equals: { man_made: 'tower' },
                    greaterThanEqual: { height: 9 },
                    error: '\'Tower\' preset height must be less than 9'
                },
                {
                    geometry: 'node',
                    equals: { man_made: 'tower' },
                    lessThan: { height: 6 },
                    error: '\'Tower\' preset height must be greater than or equal to 6'
                },
                {
                    geometry: 'node',
                    equals: { man_made: 'tower' },
                    greaterThan: { height: 9 },
                    error: '\'Tower\' preset height must be greater less than or equal to 9'
                },
                {
                    geometry: 'closedway',
                    equals: { amenity: 'clinic' },
                    negativeRegex: { emergency: ['yes', 'no'] },
                    error: '\'Clinic\' preset\'s emergency tag must be equal to \'yes\' or \'no\''
                },
                {
                    geometry: 'way',
                    equals: { highway: 'residential' },
                    positiveRegex: { structure: ['bridge', 'tunnel'] },
                    error: '\'suburban road\' structure tag cannot be \'bridge\' or \'tunnel\''
                }
            ];

            Rapid.serviceMapRules.clearRules();
            selectors.forEach(function(selector) { Rapid.serviceMapRules.addRule(selector); });
            validationRules = Rapid.serviceMapRules.validationRules();
        });
        describe('#matches', function() {
            var selectors, entities;
            before(function() {
                selectors = [
                    {
                        geometry:'node',
                        equals: {amenity:'marketplace'},
                        absence:'name',
                        error:'\'Marketplace\' preset must be coupled with name'
                    },
                    {
                        geometry: 'closedway',
                        notEquals: { building: 'yes', amenity: 'clinic' },
                        error: '\'Clinic\' preset must be coupled with building=yes'
                    },
                    {
                        geometry:'node',
                        equals: {man_made: 'tower', 'tower:type': 'communication'},
                        presence: 'height',
                        error:'\'Communication Tower\' preset must not be coupled with height'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        lessThanEqual: { height: 6 },
                        error: '\'Tower\' preset height must be greater than 6'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        greaterThanEqual: { height: 9 },
                        error: '\'Tower\' preset height must be less than 9'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        lessThan: { height: 6 },
                        error: '\'Tower\' preset height must be greater than or equal to 6'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        greaterThan: { height: 9 },
                        error: '\'Tower\' preset height must be greater less than or equal to 9'
                    },
                    {
                        geometry: 'closedway',
                        equals: { amenity: 'clinic' },
                        negativeRegex: { emergency: ['yes', 'no'] },
                        error: '\'Clinic\' preset\'s emergency tag must be equal to \'yes\' or \'no\''
                    },
                    {
                        geometry: 'way',
                        equals: { highway: 'residential' },
                        positiveRegex: { structure: ['bridge', 'tunnel'] },
                        error: '\'suburban road\' structure tag cannot be \'bridge\' or \'tunnel\''
                    }
                ];
                entities = [
                    Rapid.osmEntity({ type: 'node', tags: { amenity: 'marketplace' }}),
                    Rapid.osmWay({ tags: { building: 'house', amenity: 'clinic' }, nodes: [ 'a', 'b', 'c', 'a' ]}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', 'tower:type': 'communication', height: 5 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 6 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 9 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 5 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 10 }}),
                    Rapid.osmWay({ tags: { amenity: 'clinic', emergency: 'definitely' }, nodes: [ 'd', 'e', 'f', 'd' ]}),
                    Rapid.osmWay({ tags: { highway: 'residential', structure: 'bridge' }}),
                ];

                Rapid.serviceMapRules.clearRules();
                selectors.forEach(function(selector) { Rapid.serviceMapRules.addRule(selector); });
                validationRules = Rapid.serviceMapRules.validationRules();
            });
            it('is true when each rule check is \'true\'', function() {
                validationRules.forEach(function(rule, i) {
                    expect(rule.matches(entities[i])).to.be.true;
                });
            });
            it('is true when at least one rule check is \'false\'', function() {
                var selector = {
                    geometry: 'way',
                    equals: { highway: 'residential' },
                    positiveRegex: { structure: ['embarkment', 'bridge'] },
                    error: '\'suburban road\' structure tag cannot be \'bridge\' or \'tunnel\''
                };
                var entity = Rapid.osmWay({ tags: { highway: 'residential', structure: 'tunnel' }});
                Rapid.serviceMapRules.clearRules();
                Rapid.serviceMapRules.addRule(selector);
                var rule = Rapid.serviceMapRules.validationRules()[0];

                expect(rule.matches(entity)).to.be.false;
            });
        });
        describe('#findIssues', function() {
            var selectors, entities, _graph;

            before(function() {
                selectors = [
                    {
                        geometry:'node',
                        equals: {amenity:'marketplace'},
                        absence:'name',
                        error:'\'Marketplace\' preset must be coupled with name'
                    },
                    {
                        geometry: 'closedway',
                        notEquals: { building: 'yes', amenity: 'clinic' },
                        error: '\'Clinic\' preset must be coupled with building=yes'
                    },
                    {
                        geometry:'node',
                        equals: {man_made: 'tower', 'tower:type': 'communication'},
                        presence: 'height',
                        error:'\'Communication Tower\' preset must not be coupled with height'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        lessThanEqual: { height: 6 },
                        error: '\'Tower\' preset height must be greater than 6'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        greaterThanEqual: { height: 9 },
                        error: '\'Tower\' preset height must be less than 9'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        lessThan: { height: 6 },
                        error: '\'Tower\' preset height must be greater than or equal to 6'
                    },
                    {
                        geometry: 'node',
                        equals: { man_made: 'tower' },
                        greaterThan: { height: 9 },
                        error: '\'Tower\' preset height must be greater less than or equal to 9'
                    },
                    {
                        geometry: 'closedway',
                        equals: { amenity: 'clinic' },
                        negativeRegex: { emergency: ['yes', 'no'] },
                        error: '\'Clinic\' preset\'s emergency tag must be equal to \'yes\' or \'no\''
                    },
                    {
                        geometry: 'way',
                        equals: { highway: 'residential' },
                        positiveRegex: { structure: ['bridge', 'tunnel'] },
                        error: '\'suburban road\' structure tag cannot be \'bridge\' or \'tunnel\''
                    }
                ];
                entities = [
                    Rapid.osmEntity({ type: 'node', tags: { amenity: 'marketplace' }}),
                    Rapid.osmWay({ tags: { building: 'house', amenity: 'clinic' }, nodes: [ 'a', 'b', 'c', 'a' ]}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', 'tower:type': 'communication', height: 5 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 6 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 9 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 5 }}),
                    Rapid.osmEntity({ type: 'node', tags: { man_made: 'tower', height: 10 }}),
                    Rapid.osmWay({ tags: { amenity: 'clinic', emergency: 'definitely' }, nodes: [ 'd', 'e', 'f', 'd' ]}),
                    Rapid.osmWay({ tags: { highway: 'residential', structure: 'bridge' }}),
                ];

                var wayNodes = [
                    Rapid.osmNode({ id: 'a' }),
                    Rapid.osmNode({ id: 'b' }),
                    Rapid.osmNode({ id: 'c' }),
                    Rapid.osmNode({ id: 'd' }),
                    Rapid.osmNode({ id: 'e' }),
                    Rapid.osmNode({ id: 'f' }),
                ];
                _graph = new Rapid.Graph(entities.concat(wayNodes));
                Rapid.serviceMapRules.clearRules();
                selectors.forEach(function(selector) { Rapid.serviceMapRules.addRule(selector); });
                validationRules = Rapid.serviceMapRules.validationRules();
            });
            it('finds issues', function() {
                validationRules.forEach(function(rule, i) {
                    var issues = [];
                    var entity = entities[i];
                    var selector = selectors[i];

                    rule.findIssues(entity, _graph, issues);

                    var issue = issues[0];
                    var type = Object.keys(selector).indexOf('error') ? 'error' : 'warning';

                    expect(issues.length).to.eql(1);
                    expect(issue.entityIds).to.eql([entity.id]);
                    expect(issue.message(context)).to.eql(selector[type]);
                    expect(type).to.eql(issue.severity);
                });
            });
        });
    });
});
