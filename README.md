# multiComplexViewer
Programming task created for the position of JavaScript Software Engineer at CSIRO Data61

The multiComplex module should first have its config updated as desired. 

This can be done by altering the multiComplex.config properties manually. 
Or alternatively can be preset via the URL query string. 

##Config settings:
* Data related config:
  * **googleSpreadSheet:** published googleSpreadSheet link (eg."https://docs.google.com/spreadsheets/d/1mlnSovT52sNoAtfnB44wFqecsVE-U3M4dNAPVO9ZQws/pubhtml") will preferrentially load data from googleSpreadSheet but if none is listed will use csvFile,
  * **csvFile:** local file to load data from (eg."Programming Task - Protein Multicomplex Formation Data - TimeSeries Data.csv"),
  * **eventOrderColumn:** column name for the order data in the file to be loaded (eg. "Order"),
  * **proteinA:** column name for the first protein in an interaction in the file to be loaded (eg. "Protein A"),
  * **proteinB:** column name for the second protein in an interaction in the file to be loaded (eg. "Protein B"),
* Image size related config:
  * **xRatio:** ratio of x dimension of canvas to windowWidth, can be >0 and <= 1 (eg. 0.5),
  * **yRatio:** ratio of y dimension of canvas to windowHeight, can be >0 and <= 1 (eg. 0.5),
  * **outerWidth:** used to overRide the setting made by xRatio if a set canvas width is desired,
  * **outerHeight:** used to overRide the setting made by yRatio if a set canvas height is desired,
* **useURLConfig:** false by default. If true will use the query string to populate and config 
##Usage  
  Calling the multiComplex.draw() function should then collect the data, process it and render the multicomplex as per the config
