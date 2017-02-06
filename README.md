#Module: multiComplex
The multiComplex module takes data specified in either config.googleSpreadSheet or config.csvFile and renders it via SVG and the the d3 library to the selector specified in config.selector 

The Data should have at least the below form

| Protein A |	Protein B |	Order |
| --- | --- | --- |
| P1	| P2	| 1 |
| P1	| P3	| 2 |
| P1	| P4	| 3 |
| P2	| P3	| 3 |

Where each row represents an interaction event between 2 proteins
* The "Protein A" (config.proteinAColumn) column should contain the name of one of the proteins involved in the interaction event.
* The "Protein B" (config.proteinBColumn)column should contain the name of the other protein involved in the interaction event.
* The "Order" (config.eventOrderColumn)column should specify the order in which the interaction events occur in contiguous incrementing integers starting from 1
Source:
multiComplex.js, line 1
Example
```javascript
muliComplex.config.googleSpreadSheet = "https://docs.google.com/spreadsheets/d/1mlnSovT52sNoAtfnB44wFqecsVE-U3M4dNAPVO9ZQws/pubhtml";
muliComplex.config.selector = "#mySelector";
multiComplex.draw();
```
###Requires
module:d3.js
module:tabletop.js
##Members
###(static) config

configuration settings to determine how the module will load event data and render tracks
Properties:

| Name	|Type	| Description |
| --- | --- | --- |
| googleSpreadSheet	| url	| published googleSpreadSheet link. multiComplex will preferrentially load data from googleSpreadSheet but if none is listed will use csvFile |
| csvFile	| filePath	| local .csv file to load data from |
| eventOrderColumn	| string	|column name for the "order" data in the file to be loaded |
| proteinAColumn	| string	|column name for the first protein in an interaction in the file to be loaded |
| proteinBColumn	| string	|column name for the second protein in an interaction in the file to be loaded |
| xRatio	| decimal	| ratio of x dimension of canvas to windowWidth, can be >0 and <= 1 |
| yRatio	| decimal	| ratio of y dimension of canvas to windowHeight, can be >0 and <= 1 |
| outerWidth	| number	| canvas width in px. Used to overRide the setting made by xRatio if a set canvas width is desired |
| outerHeight	| number	| canvas height in px. used to overRide the setting made by yRatio if a set canvas height is desired |
| selector	| string	| used to specified the DOM element that the SVG canvas will be appended to |

Source:
multiComplex.js, line 41
##Methods
###(static) draw()

Triggers loading and processing data, generating settings from config and rendering data
Source:
multiComplex.js, line 58
