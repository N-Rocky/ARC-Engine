# (Untitled) Game Engine

> ### Layout Design
> - Inspector. Changes based on selected object, but always contains a transform component that updates the position of the selected object (two textboxes for x and y values).
> - Taskbar. Holds all user generated data, including assets and every object created in the game window.

> ### Inspector
> - Identity. Allows users to change the name of the object that can later be referenced by other objects through their behavior. Users can also set and create tags here for use with trigger colliders.
> - Transform. Allows users to directly edit the position, scale, and possibly rotation of each object.
> - Graphics. Allows users to change the shape and material of each object (color versus image file). Other settings too like outlines, alpha, and gradients.
> - Physics. Allows users to set the "kinematic" attribute and adjust collider size. Users can also edit things like mass, friction, bounciness, and the application of gravity.
> - Behavior. Allows users to write custom behavior for each object through scripting. Opens up a separate IDE for programming in.

> ### IDE
> - Opens up and covers the majority of the screen. Contains a list on the right with every avilable local attribute, as well as every available global attribute. Comes with a few pre-written methods for Awake() and Update(), as well as methods for user input and trigger collider.
> - Users have the ability to toggle between custom language and JS, allowing them to see the conversion between the two and program with both.
> - Create local variables that reference global ones so users can access them with better names within their custom behaviors. Create them right before the custom behavior is interpreted.

> ### Frontend
> - Index file contains all of the rendering logic and receives its data from the external logic file.
> - Index file handles all GUI elements and the starting/stopping of the game.