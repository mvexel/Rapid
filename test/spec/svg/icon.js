describe('svgIcon', function () {
    var selection;

    beforeEach(function () {
        selection = d3.select(document.createElement('div'));
    });

    it('creates a generic SVG icon', function () {
        selection.call(Rapid.svgIcon('#rapid-icon-bug'));
        expect(selection.select('svg').classed('icon')).to.be.true;
        expect(selection.select('use').attr('xlink:href')).to.eql('#rapid-icon-bug');
    });

    it('classes the \'svg\' and \'use\' elements', function () {
        selection.call(Rapid.svgIcon('#rapid-icon-bug', 'svg-class', 'use-class'));
        expect(selection.select('svg').classed('icon svg-class')).to.be.true;
        expect(selection.select('use').classed('use-class')).to.be.true;
    });
});
