describe('presetPreset', function() {

    describe('#fields', function() {
        it('has no fields by default', function() {
            var preset = Rapid.presetPreset('test', {});
            expect(preset.fields()).to.eql([]);
        });
    });

    describe('#moreFields', function() {
        it('has no moreFields by default', function() {
            var preset = Rapid.presetPreset('test', {});
            expect(preset.moreFields()).to.eql([]);
        });
    });

    describe('#matchGeometry', function() {
        it('returns false if it doesn\'t match', function() {
            var preset = Rapid.presetPreset('test', {geometry: ['line']});
            expect(preset.matchGeometry('point')).to.equal(false);
        });

        it('returns true if it does match', function() {
            var preset = Rapid.presetPreset('test', {geometry: ['point', 'line']});
            expect(preset.matchGeometry('point')).to.equal(true);
        });
    });

    describe('#matchAllGeometry', function() {
        it('returns false if they don\'t all match', function() {
            var preset = Rapid.presetPreset('test', {geometry: ['line']});
            expect(preset.matchAllGeometry(['point','line'])).to.equal(false);
        });

        it('returns true if they do all match', function() {
            var preset = Rapid.presetPreset('test', {geometry: ['point', 'line']});
            expect(preset.matchAllGeometry(['point','line'])).to.equal(true);
        });
    });

    describe('#matchScore', function() {
        it('returns -1 if preset does not match tags', function() {
            var preset = Rapid.presetPreset('test', {tags: {foo: 'bar'}});
            var entity = Rapid.osmWay({tags: {highway: 'motorway'}});
            expect(preset.matchScore(entity.tags)).to.equal(-1);
        });

        it('returns the value of the matchScore property when matched', function() {
            var preset = Rapid.presetPreset('test', {tags: {highway: 'motorway'}, matchScore: 0.2});
            var entity = Rapid.osmWay({tags: {highway: 'motorway'}});
            expect(preset.matchScore(entity.tags)).to.equal(0.2);
        });

        it('defaults to the number of matched tags', function() {
            var preset = Rapid.presetPreset('test', {tags: {highway: 'residential'}});
            var entity = Rapid.osmWay({tags: {highway: 'residential'}});
            expect(preset.matchScore(entity.tags)).to.equal(1);

            preset = Rapid.presetPreset('test', {tags: {highway: 'service', service: 'alley'}});
            entity = Rapid.osmWay({tags: {highway: 'service', service: 'alley'}});
            expect(preset.matchScore(entity.tags)).to.equal(2);
        });

        it('counts * as a match for any value with score 0.5', function() {
            var preset = Rapid.presetPreset('test', {tags: {building: '*'}});
            var entity = Rapid.osmWay({tags: {building: 'yep'}});
            expect(preset.matchScore(entity.tags)).to.equal(0.5);
        });

        it('boosts matchScore for additional matches in addTags', function() {
            var presetSupercenter = Rapid.presetPreset('shop/supermarket/walmart_supercenter', {
                tags: { 'brand:wikidata': 'Q483551', 'shop': 'supermarket' },
                addTags: { 'name': 'Walmart Supercenter' }
            });
            var presetMarket = Rapid.presetPreset('shop/supermarket/walmart_market', {
                tags: { 'brand:wikidata': 'Q483551', 'shop': 'supermarket' },
                addTags: { 'name': 'Walmart Neighborhood Market' }
            });

            var supercenter = Rapid.osmWay({ tags: {
                'brand:wikidata': 'Q483551',
                'shop': 'supermarket',
                'name': 'Walmart Supercenter'
            }});
            var market = Rapid.osmWay({ tags: {
                'brand:wikidata': 'Q483551',
                'shop': 'supermarket',
                'name': 'Walmart Neighborhood Market'
            }});

            expect(presetSupercenter.matchScore(supercenter.tags))
                .to.be.greaterThan(presetMarket.matchScore(supercenter.tags));

            expect(presetMarket.matchScore(market.tags))
                .to.be.greaterThan(presetSupercenter.matchScore(market.tags));
        });
    });

    describe('isFallback', function() {
        it('returns true if preset has no tags', function() {
            var preset = Rapid.presetPreset('point', {tags: {}});
            expect(preset.isFallback()).to.equal(true);
        });

        it('returns true if preset has a single \'area\' tag', function() {
            var preset = Rapid.presetPreset('area', {tags: {area: 'yes'}});
            expect(preset.isFallback()).to.equal(true);
        });

        it('returns false if preset has a single non-\'area\' tag', function() {
            var preset = Rapid.presetPreset('building', {tags: {building: 'yes'}});
            expect(preset.isFallback()).to.equal(false);
        });

        it('returns false if preset has multiple tags', function() {
            var preset = Rapid.presetPreset('building', {tags: {area: 'yes', building: 'yes'}});
            expect(preset.isFallback()).to.equal(false);
        });
    });

    describe('#setTags', function() {
        var _savedAreaKeys;

        before(function () {
            _savedAreaKeys = Rapid.osmAreaKeys;
            Rapid.osmSetAreaKeys({ building: {}, natural: {} });
        });

        after(function () {
            Rapid.osmSetAreaKeys(_savedAreaKeys);
        });

        it('adds match tags', function() {
            var preset = Rapid.presetPreset('test', {tags: {highway: 'residential'}});
            expect(preset.setTags({}, 'line')).to.eql({highway: 'residential'});
        });

        it('adds wildcard tags with value \'yes\'', function() {
            var preset = Rapid.presetPreset('test', {tags: {natural: '*'}});
            expect(preset.setTags({}, 'area')).to.eql({natural: 'yes'});
        });

        it('prefers to add tags of addTags property', function() {
            var preset = Rapid.presetPreset('test', {tags: {building: '*'}, addTags: {building: 'ok'}});
            expect(preset.setTags({}, 'area')).to.eql({building: 'ok'});
        });

        it('adds default tags of fields with matching geometry', function() {
            var isAddable = true;
            var field = Rapid.presetField('field', {key: 'building', geometry: 'area', default: 'yes'});
            var preset = Rapid.presetPreset('test', {fields: ['field']}, isAddable, {field: field});
            expect(preset.setTags({}, 'area')).to.eql({area: 'yes', building: 'yes'});
        });

        it('adds no default tags of fields with non-matching geometry', function() {
            var isAddable = true;
            var field = Rapid.presetField('field', {key: 'building', geometry: 'area', default: 'yes'});
            var preset = Rapid.presetPreset('test', {fields: ['field']}, isAddable, {field: field});
            expect(preset.setTags({}, 'point')).to.eql({});
        });

        describe('for a preset with no tag in areaKeys', function() {
            var preset = Rapid.presetPreset('test', {geometry: ['line', 'area'], tags: {name: 'testname', highway: 'pedestrian'}});

            it('doesn\'t add area=yes to non-areas', function() {
                expect(preset.setTags({}, 'line')).to.eql({name: 'testname', highway: 'pedestrian'});
            });

            it('adds area=yes to areas', function() {
                expect(preset.setTags({}, 'area')).to.eql({name: 'testname', highway: 'pedestrian', area: 'yes'});
            });
        });

        describe('for a preset with a tag in areaKeys', function() {
            it('doesn\'t add area=yes automatically', function() {
                var preset = Rapid.presetPreset('test', {geometry: ['area'], tags: {name: 'testname', building: 'yes'}});
                expect(preset.setTags({}, 'area')).to.eql({name: 'testname', building: 'yes'});
            });

            it('does add area=yes if asked to', function() {
                var preset = Rapid.presetPreset('test', {geometry: ['area'], tags: {name: 'testname', area: 'yes'}});
                expect(preset.setTags({}, 'area')).to.eql({name: 'testname', area: 'yes'});
            });
        });
    });

    describe('#unsetTags', function() {
        it('removes tags that match preset tags', function() {
            var preset = Rapid.presetPreset('test', {tags: {highway: 'residential'}});
            expect(preset.unsetTags({highway: 'residential'}, 'area')).to.eql({});
        });

        it('removes tags that match field default tags', function() {
            var isAddable = true;
            var field = Rapid.presetField('field', {key: 'building', geometry: 'area', default: 'yes'});
            var preset = Rapid.presetPreset('test', {fields: ['field']}, isAddable, {field: field});
            expect(preset.unsetTags({building: 'yes'}, 'area')).to.eql({});
        });

        it('removes area=yes', function() {
            var preset = Rapid.presetPreset('test', {tags: {highway: 'pedestrian'}});
            expect(preset.unsetTags({highway: 'pedestrian', area: 'yes'}, 'area')).to.eql({});
        });

        it('preserves tags that do not match field default tags', function() {
            var isAddable = true;
            var field = Rapid.presetField('field', {key: 'building', geometry: 'area', default: 'yes'});
            var preset = Rapid.presetPreset('test', {fields: ['field']}, isAddable, {field: field});
            expect(preset.unsetTags({building: 'yep'}, 'area')).to.eql({ building: 'yep'});
        });

        it('preserves tags that are not listed in removeTags', function() {
            var preset = Rapid.presetPreset('test', {tags: {a: 'b'}, removeTags: {}});
            expect(preset.unsetTags({a: 'b'}, 'area')).to.eql({a: 'b'});
        });

        it('uses tags from addTags if removeTags is not defined', function() {
            var preset = Rapid.presetPreset('test', {tags: {a: 'b'}, addTags: {remove: 'me'}});
            expect(preset.unsetTags({a: 'b', remove: 'me'}, 'area')).to.eql({a: 'b'});
        });
    });

    describe('#addable', function() {
        it('sets/gets addability of preset', function() {
            var preset = Rapid.presetPreset('test', {}, false);
            expect(preset.addable()).to.be.false;
            preset.addable(true);
            expect(preset.addable()).to.be.true;
        });
    });
});
