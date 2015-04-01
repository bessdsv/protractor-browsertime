describe("test", function() {
  it("test", function() {
    browser.getWithStatistic("http://www.google.com", 'temp.har', 'temp.json');
    expect(1).toEqual(1);
  });
});
